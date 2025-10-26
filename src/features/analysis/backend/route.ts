import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '@/backend/middleware/auth';
import { respond, success, failure } from '@/backend/http/response';
import { getAnalysisHistory, getAnalysisById, createAnalysis, getAnalysisDetail } from './service';
import { createAnalysisRequestSchema, AnalysisIdParamsSchema } from './schema';
import { checkUsageLimit } from '@/backend/services/usage';
import { CommonErrorCode } from '@/backend/errors/codes';
import type { AppEnv } from '@/backend/hono/context';
import { getLogger, getSupabase } from '@/backend/hono/context';

export const analysisRouter = new Hono<AppEnv>();

export function registerAnalysisRoutes(app: Hono<AppEnv>) {
  app.route('/api', analysisRouter);
}

/**
 * 쿼리 파라미터 스키마
 */
const querySchema = z.object({
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1))
    .default('1'),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(20))
    .default('10'),
});

/**
 * GET /api/analyses
 *
 * 분석 이력 목록 조회 (페이지네이션)
 */
analysisRouter.get('/analyses', requireAuth(), zValidator('query', querySchema), async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = c.get('supabase');

    if (!userId) {
      return respond(
        c,
        failure(401, CommonErrorCode.UNAUTHORIZED, '로그인이 필요합니다')
      );
    }

    const { page, limit } = c.req.valid('query');

    const history = await getAnalysisHistory(supabase, userId, page, limit);

    return respond(c, success(history));
  } catch (error) {
    const logger = c.get('logger');
    logger.error('Failed to get analysis history', error);

    return respond(
      c,
      failure(500, CommonErrorCode.INTERNAL_ERROR, '분석 이력을 불러올 수 없습니다')
    );
  }
});

/**
 * GET /api/analyses/:id
 *
 * 특정 분석 상세 조회 (상세보기 페이지)
 */
analysisRouter.get('/analyses/:id', requireAuth(), async (c) => {
  const logger = getLogger(c);
  const supabase = getSupabase(c);
  const userId = c.get('userId');

  // 1. 파라미터 검증
  const parsedParams = AnalysisIdParamsSchema.safeParse({
    id: c.req.param('id'),
  });

  if (!parsedParams.success) {
    return respond(
      c,
      failure(
        400,
        'INVALID_PARAMS',
        '유효하지 않은 분석 ID입니다',
        parsedParams.error.format()
      )
    );
  }

  // 2. 서비스 호출
  const result = await getAnalysisDetail(
    supabase,
    parsedParams.data.id,
    userId!
  );

  // 3. 에러 로깅 (500번대 에러만)
  if (!result.ok && result.status >= 500) {
    logger.error('Failed to fetch analysis', {
      analysisId: parsedParams.data.id,
      userId,
      error: 'error' in result ? result.error : undefined,
    });
  }

  // 4. 응답 반환
  return respond(c, result);
});

/**
 * POST /api/analyses
 *
 * 새로운 사주 분석 생성
 */
analysisRouter.post(
  '/analyses',
  requireAuth(),
  zValidator('json', createAnalysisRequestSchema),
  async (c) => {
    const userId = c.get('userId');
    if (!userId) {
      return respond(
        c,
        failure(401, CommonErrorCode.UNAUTHORIZED, '인증이 필요합니다')
      );
    }

    const body = c.req.valid('json');
    const supabase = c.get('supabase');
    const logger = c.get('logger');
    const config = c.get('config');

    const result = await createAnalysis(
      supabase,
      userId,
      body,
      logger,
      config.gemini.apiKey
    );

    return respond(c, result);
  }
);

/**
 * GET /api/analyses/usage
 *
 * 사용자의 분석 사용량 조회
 */
analysisRouter.get('/analyses/usage', requireAuth(), async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return respond(
      c,
      failure(401, CommonErrorCode.UNAUTHORIZED, '인증이 필요합니다')
    );
  }

  const supabase = c.get('supabase');
  const logger = c.get('logger');

  try {
    const usageInfo = await checkUsageLimit(supabase, userId);

    // 구독 티어 조회
    const { data: user } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const subscriptionTier = (user?.subscription_tier as 'free' | 'pro') || 'free';

    return c.json({
      subscriptionTier,
      used: usageInfo.used,
      limit: usageInfo.limit,
      remaining: usageInfo.remaining,
      nextResetDate: usageInfo.nextResetDate?.toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch usage', error);
    return respond(
      c,
      failure(500, CommonErrorCode.INTERNAL_ERROR, '사용량 조회 중 오류가 발생했습니다')
    );
  }
});
