import type { SupabaseClient } from '@supabase/supabase-js';
import type { Analysis, AnalysisHistoryResponse, CreateAnalysisRequest, AnalysisResponse, AnalysisDetailResponse } from './schema';
import { analysisResultContentSchema } from './schema';
import type { AppLogger } from '@/backend/hono/context';
import { checkUsageLimit } from '@/backend/services/usage';
import { callGeminiAnalysis, type GeminiModel } from '@/backend/integrations/gemini/client';
import { AnalysisErrorCode } from './error';
import { failure, success, type HandlerResult } from '@/backend/http/response';
import type { AnalysisServiceError } from './error';
import { AnalysisResultSchema } from './schema';

/**
 * 분석 생성 서비스
 */
export async function createAnalysis(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAnalysisRequest,
  logger: AppLogger,
  geminiApiKey: string
): Promise<HandlerResult<AnalysisResponse, string>> {
  try {
    // 1. 사용자 정보 및 구독 상태 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, subscription_tier')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('User not found', userError);
      return failure(
        404,
        AnalysisErrorCode.USER_NOT_FOUND,
        '사용자를 찾을 수 없습니다'
      );
    }

    // 2. 사용량 체크
    try {
      const usageInfo = await checkUsageLimit(supabase, userId);

      if (usageInfo.remaining <= 0) {
        logger.warn('Usage limit exceeded', { userId, usageInfo });
        return failure(
          400,
          AnalysisErrorCode.USAGE_LIMIT_EXCEEDED,
          usageInfo.subscriptionTier === 'free'
            ? '무료 체험 1회를 모두 사용하였습니다. Pro 구독을 통해 월 10회 분석을 이용하세요.'
            : '이번 달 분석 횟수를 모두 사용하였습니다.'
        );
      }
    } catch (error) {
      logger.error('Failed to check usage limit', error);
      return failure(
        500,
        AnalysisErrorCode.DATABASE_ERROR,
        '사용량 확인 중 오류가 발생했습니다'
      );
    }

    // 3. 모델 선택
    const subscriptionTier = user.subscription_tier as 'free' | 'pro';
    const model: GeminiModel =
      subscriptionTier === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

    // 4. Gemini AI 분석 호출
    let analysisResult;
    try {
      analysisResult = await callGeminiAnalysis(
        {
          birthDate: new Date(input.birthDate),
          birthTime: input.birthTime || undefined,
          isLunar: input.isLunar,
          gender: input.gender,
        },
        model,
        geminiApiKey
      );
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error('Gemini API call failed', { error: errorMessage });

      if (errorMessage.includes('API_QUOTA_EXCEEDED')) {
        return failure(
          503,
          AnalysisErrorCode.API_QUOTA_EXCEEDED,
          'AI 분석 서비스의 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'
        );
      }

      return failure(
        503,
        AnalysisErrorCode.AI_SERVICE_ERROR,
        'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      );
    }

    // 5. 분석 결과 저장
    const { data: analysis, error: insertError } = await supabase
      .from('analyses')
      .insert({
        user_id: userId,
        birth_date: input.birthDate,
        birth_time: input.birthTime || null,
        is_lunar: input.isLunar,
        gender: input.gender,
        result: analysisResult as unknown as Record<string, unknown>,
        model_used: model,
      })
      .select()
      .single();

    if (insertError || !analysis) {
      logger.error('Failed to save analysis', insertError);
      return failure(
        500,
        AnalysisErrorCode.DATABASE_ERROR,
        '분석 결과 저장 중 오류가 발생했습니다'
      );
    }

    logger.info('Analysis created successfully', { analysisId: analysis.id, userId });

    // 6. 응답 반환
    return success({
      id: analysis.id,
      userId: analysis.user_id,
      birthDate: analysis.birth_date,
      birthTime: analysis.birth_time,
      isLunar: analysis.is_lunar,
      gender: analysis.gender,
      result: analysis.result as Record<string, unknown>,
      modelUsed: analysis.model_used,
      createdAt: analysis.created_at,
    });
  } catch (error) {
    logger.error('Unexpected error in createAnalysis', error);
    return failure(
      500,
      'INTERNAL_ERROR',
      '분석 처리 중 예상치 못한 오류가 발생했습니다'
    );
  }
}

/**
 * 분석 이력 조회
 */
export async function getAnalysisHistory(
  supabase: SupabaseClient,
  userId: string,
  page: number,
  limit: number
): Promise<AnalysisHistoryResponse> {
  const offset = (page - 1) * limit;

  const { count, error: countError } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    throw new Error('FAILED_TO_COUNT_ANALYSES');
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error('FAILED_TO_FETCH_ANALYSES');
  }

  return {
    data: data.map((item) => ({
      id: item.id,
      userId: item.user_id,
      birthDate: item.birth_date,
      birthTime: item.birth_time,
      isLunar: item.is_lunar,
      gender: item.gender,
      result: item.result,
      modelUsed: item.model_used,
      createdAt: item.created_at,
    })),
    total,
    page,
    totalPages,
  };
}

/**
 * 특정 분석 상세 조회
 */
export async function getAnalysisById(
  supabase: SupabaseClient,
  userId: string,
  analysisId: string
): Promise<Analysis> {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .single();

  if (error || !data) {
    throw new Error('ANALYSIS_NOT_FOUND');
  }

  if (data.user_id !== userId) {
    throw new Error('ANALYSIS_FORBIDDEN');
  }

  return {
    id: data.id,
    userId: data.user_id,
    birthDate: data.birth_date,
    birthTime: data.birth_time,
    isLunar: data.is_lunar,
    gender: data.gender,
    result: data.result,
    modelUsed: data.model_used,
    createdAt: data.created_at,
  };
}

/**
 * 분석 상세 조회 (상세보기 페이지용 - HandlerResult 패턴)
 */
export async function getAnalysisDetail(
  supabase: SupabaseClient,
  analysisId: string,
  userId: string
): Promise<HandlerResult<AnalysisDetailResponse, AnalysisServiceError>> {
  // 1. 분석 조회
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .single();

  // 2. 데이터베이스 오류 처리
  if (error) {
    return failure(
      404,
      AnalysisErrorCode.ANALYSIS_NOT_FOUND,
      '분석을 찾을 수 없습니다'
    );
  }

  // 3. 존재하지 않는 분석
  if (!data) {
    return failure(
      404,
      AnalysisErrorCode.ANALYSIS_NOT_FOUND,
      '분석을 찾을 수 없습니다'
    );
  }

  // 4. 권한 확인 (본인 분석만 조회 가능)
  if (data.user_id !== userId) {
    return failure(
      403,
      AnalysisErrorCode.ANALYSIS_FORBIDDEN,
      '본인의 분석 결과만 조회할 수 있습니다'
    );
  }

  // 5. JSONB 파싱 검증
  const resultValidation = analysisResultContentSchema.safeParse(data.result);
  if (!resultValidation.success) {
    return failure(
      500,
      AnalysisErrorCode.ANALYSIS_DATA_CORRUPTED,
      '분석 결과를 불러오는 중 오류가 발생했습니다',
      resultValidation.error.format()
    );
  }

  // 6. DTO 변환 및 반환
  const response: AnalysisDetailResponse = {
    analysis: {
      id: data.id,
      userId: data.user_id,
      birthDate: data.birth_date,
      birthTime: data.birth_time,
      isLunar: data.is_lunar,
      gender: data.gender,
      modelUsed: data.model_used,
      result: resultValidation.data,
      createdAt: data.created_at,
    },
  };

  return success(response);
}
