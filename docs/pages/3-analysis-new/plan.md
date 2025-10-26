# 구현 계획: 새 분석하기 페이지 (`/analysis/new`)

## 개요

본 문서는 사주 분석 요청 페이지(`/analysis/new`)의 구체적인 구현 계획을 정의합니다. PRD, Userflow, Database 설계, 상태관리 설계, 공통 모듈 문서를 기반으로 작성되었으며, 기존 코드베이스 구조를 엄격히 준수합니다.

**목표**:
- 무료/Pro 사용자 모두 사주 분석 요청 가능
- 사용량 제한 확인 및 초과 시 적절한 안내
- Gemini AI를 통한 사주 분석 수행
- 분석 결과를 데이터베이스에 영구 저장
- 분석 완료 후 상세보기 페이지로 이동

**참고 문서**:
- PRD: `/docs/prd.md` (섹션 3.2.4, 6.3, 6.4)
- Userflow: `/docs/userflow.md` (섹션 1.2, 3)
- Database: `/docs/database.md` (섹션 3.3)
- State: `/docs/pages/3-analysis-new/state.md`
- Common Modules: `/docs/common-modules.md`
- Usecase 1: `/docs/usecases/1-signup-and-first-analysis/spec.md`
- Usecase 3: `/docs/usecases/3-analysis-request/spec.md`

---

## 1. 페이지 라우팅 및 보호

### 1.1 라우트 설정

**경로**: `/analysis/new`

**파일 위치**: `src/app/(protected)/analysis/new/page.tsx`

**접근 제어**:
- 인증 필수 (Clerk 미들웨어)
- `(protected)` 레이아웃 그룹 사용 (기존 패턴 준수)
- 비인증 사용자는 자동으로 로그인 페이지로 리다이렉트

**구현**:
```typescript
// src/app/(protected)/analysis/new/page.tsx
'use client';

import { AnalysisNewProvider } from '@/features/analysis/context/analysis-new-context';
import { AnalysisNewPage } from '@/features/analysis/components/analysis-new-page';

export default async function AnalysisNew() {
  return (
    <AnalysisNewProvider>
      <AnalysisNewPage />
    </AnalysisNewProvider>
  );
}
```

---

## 2. Backend 구현

### 2.1 API 라우트 설계

#### 2.1.1 분석 생성 API

**Endpoint**: `POST /api/analyses`

**파일 위치**: `src/features/analysis/backend/route.ts`

**역할**:
- 사용자 인증 확인
- 사용량 체크 (무료: 1회, Pro: 월 10회)
- Gemini API 호출 (모델 분기: Flash/Pro)
- 분석 결과 저장
- 트랜잭션 관리

**요청 스키마**:
```typescript
// src/features/analysis/backend/schema.ts
import { z } from 'zod';

export const createAnalysisRequestSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  isLunar: z.boolean(),
  gender: z.enum(['male', 'female']),
});

export type CreateAnalysisRequest = z.infer<typeof createAnalysisRequestSchema>;

export const analysisResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  birthDate: z.string(),
  birthTime: z.string().nullable(),
  isLunar: z.boolean(),
  gender: z.enum(['male', 'female']),
  result: z.record(z.unknown()), // JSONB
  modelUsed: z.enum(['gemini-2.5-flash', 'gemini-2.5-pro']),
  createdAt: z.string(),
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
```

**응답 형식**:
- 성공: `200 OK { data: AnalysisResponse }`
- 실패: `4xx/5xx { error: { code: string, message: string } }`

**라우트 구현**:
```typescript
// src/features/analysis/backend/route.ts
import { Hono } from 'hono';
import type { AppEnv } from '@/backend/hono/context';
import { requireAuth } from '@/backend/middleware/auth';
import { zValidator } from '@hono/zod-validator';
import { createAnalysisRequestSchema } from './schema';
import { createAnalysis } from './service';
import { success, failure } from '@/backend/http/response';
import { AnalysisErrorCode } from './error';

export function registerAnalysisRoutes(app: Hono<AppEnv>) {
  const analysisApp = new Hono<AppEnv>();

  analysisApp.post(
    '/',
    requireAuth(),
    zValidator('json', createAnalysisRequestSchema),
    async (c) => {
      try {
        const userId = c.get('userId');
        if (!userId) {
          return failure(401, 'UNAUTHORIZED', '인증이 필요합니다');
        }

        const body = c.req.valid('json');
        const supabase = c.get('supabase');
        const logger = c.get('logger');

        const result = await createAnalysis(supabase, userId, body, logger);

        if (!result.success) {
          return failure(result.status, result.error, result.message);
        }

        return success(result.data);
      } catch (error) {
        const logger = c.get('logger');
        logger.error('Failed to create analysis', error);
        return failure(500, 'INTERNAL_ERROR', '분석 요청 처리 중 오류가 발생했습니다');
      }
    }
  );

  app.route('/api/analyses', analysisApp);
}
```

#### 2.1.2 사용량 조회 API

**Endpoint**: `GET /api/usage`

**파일 위치**: `src/features/analysis/backend/route.ts` (동일 파일)

**역할**:
- 현재 사용자의 사용량 정보 반환
- 구독 상태에 따른 제한 및 남은 횟수 계산

**응답 스키마**:
```typescript
export const usageResponseSchema = z.object({
  subscriptionTier: z.enum(['free', 'pro']),
  used: z.number().int().min(0),
  limit: z.number().int().min(1),
  remaining: z.number().int().min(0),
  nextResetDate: z.string().optional(), // Pro 유저만
});

export type UsageResponse = z.infer<typeof usageResponseSchema>;
```

**라우트 구현**:
```typescript
analysisApp.get('/usage', requireAuth(), async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return failure(401, 'UNAUTHORIZED', '인증이 필요합니다');
    }

    const supabase = c.get('supabase');
    const logger = c.get('logger');

    const usageInfo = await checkUsageLimit(supabase, userId);

    return success({
      subscriptionTier: usageInfo.subscriptionTier,
      used: usageInfo.used,
      limit: usageInfo.limit,
      remaining: usageInfo.remaining,
      nextResetDate: usageInfo.nextResetDate?.toISOString(),
    });
  } catch (error) {
    const logger = c.get('logger');
    logger.error('Failed to fetch usage', error);
    return failure(500, 'INTERNAL_ERROR', '사용량 조회 중 오류가 발생했습니다');
  }
});
```

---

### 2.2 서비스 레이어

**파일 위치**: `src/features/analysis/backend/service.ts`

**역할**:
- 비즈니스 로직 구현
- Supabase 및 Gemini API와의 상호작용

**주요 함수**:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '@/backend/hono/context';
import type { CreateAnalysisRequest, AnalysisResponse } from './schema';
import { checkUsageLimit, consumeUsage } from '@/backend/services/usage';
import { callGeminiAnalysis, type GeminiModel } from '@/backend/integrations/gemini/client';
import { AnalysisErrorCode } from './error';

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}

export async function createAnalysis(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAnalysisRequest,
  logger: Logger
): Promise<ServiceResult<AnalysisResponse>> {
  try {
    // 1. 사용자 정보 및 구독 상태 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, subscription_tier')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('User not found', userError);
      return {
        success: false,
        status: 404,
        error: 'USER_NOT_FOUND',
        message: '사용자를 찾을 수 없습니다',
      };
    }

    // 2. 사용량 체크
    const usageInfo = await checkUsageLimit(supabase, userId);

    if (usageInfo.remaining <= 0) {
      logger.warn('Usage limit exceeded', { userId, usageInfo });
      return {
        success: false,
        status: 400,
        error: AnalysisErrorCode.USAGE_LIMIT_EXCEEDED,
        message: usageInfo.subscriptionTier === 'free'
          ? '무료 체험 1회를 모두 사용하였습니다. Pro 구독을 통해 월 10회 분석을 이용하세요.'
          : '이번 달 분석 횟수를 모두 사용하였습니다.',
      };
    }

    // 3. 모델 선택
    const model: GeminiModel = user.subscription_tier === 'pro'
      ? 'gemini-2.5-pro'
      : 'gemini-2.5-flash';

    // 4. Gemini AI 분석 호출
    const analysisResult = await callGeminiAnalysis(
      {
        birthDate: new Date(input.birthDate),
        birthTime: input.birthTime || undefined,
        isLunar: input.isLunar,
        gender: input.gender,
      },
      model
    );

    // 5. 트랜잭션: 결과 저장 및 사용량 차감
    const { data: analysis, error: insertError } = await supabase
      .from('analyses')
      .insert({
        user_id: userId,
        birth_date: input.birthDate,
        birth_time: input.birthTime || null,
        is_lunar: input.isLunar,
        gender: input.gender,
        result: analysisResult,
        model_used: model,
      })
      .select()
      .single();

    if (insertError || !analysis) {
      logger.error('Failed to save analysis', insertError);
      return {
        success: false,
        status: 500,
        error: 'DATABASE_ERROR',
        message: '분석 결과 저장 중 오류가 발생했습니다',
      };
    }

    logger.info('Analysis created successfully', { analysisId: analysis.id, userId });

    // 6. 응답 반환
    return {
      success: true,
      data: {
        id: analysis.id,
        userId: analysis.user_id,
        birthDate: analysis.birth_date,
        birthTime: analysis.birth_time,
        isLunar: analysis.is_lunar,
        gender: analysis.gender,
        result: analysis.result,
        modelUsed: analysis.model_used,
        createdAt: analysis.created_at,
      },
    };
  } catch (error) {
    logger.error('Unexpected error in createAnalysis', error);
    return {
      success: false,
      status: 500,
      error: 'INTERNAL_ERROR',
      message: '분석 처리 중 예상치 못한 오류가 발생했습니다',
    };
  }
}
```

---

### 2.3 에러 코드 정의

**파일 위치**: `src/features/analysis/backend/error.ts`

```typescript
export const AnalysisErrorCode = {
  USAGE_LIMIT_EXCEEDED: 'USAGE_LIMIT_EXCEEDED',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  API_QUOTA_EXCEEDED: 'API_QUOTA_EXCEEDED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  INVALID_INPUT: 'INVALID_INPUT',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type AnalysisErrorCode = typeof AnalysisErrorCode[keyof typeof AnalysisErrorCode];
```

---

### 2.4 Hono 앱에 라우트 등록

**파일 위치**: `src/backend/hono/app.ts` (기존 파일 수정)

```typescript
import { registerAnalysisRoutes } from '@/features/analysis/backend/route';

export function createHonoApp(): Hono<AppEnv> {
  // ... 기존 코드 ...

  // 라우트 등록
  registerExampleRoutes(app);
  registerAnalysisRoutes(app); // 추가

  return app;
}
```

---

## 3. Frontend 구현

### 3.1 상태 관리 (Context + useReducer)

**파일 위치**: `src/features/analysis/context/analysis-new-context.tsx`

**역할**:
- 사용량 정보 관리
- 폼 제출 상태 관리
- React Query와 통합

**구현** (상태관리 설계 문서 참조):
```typescript
'use client';

import React, { createContext, useContext, useReducer } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/remote/api-client';
import type { UsageResponse, AnalysisResponse, CreateAnalysisRequest } from '../backend/schema';
import { extractApiErrorMessage } from '@/lib/remote/types';

// 상태 인터페이스
export interface UsageInfo {
  subscriptionTier: 'free' | 'pro';
  used: number;
  limit: number;
  remaining: number;
  nextResetDate?: Date;
}

export interface AnalysisNewState {
  usageInfo: UsageInfo | null;
  isLoadingUsage: boolean;
  usageError: Error | null;
  isSubmitting: boolean;
  submitError: string | null;
}

export type AnalysisNewAction =
  | { type: 'FETCH_USAGE_START' }
  | { type: 'FETCH_USAGE_SUCCESS'; payload: UsageInfo }
  | { type: 'FETCH_USAGE_ERROR'; payload: Error }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; payload: string }
  | { type: 'RESET_ERROR' };

export interface AnalysisNewContextValue {
  state: AnalysisNewState;
  dispatch: React.Dispatch<AnalysisNewAction>;
  canSubmit: boolean;
  usageExceeded: boolean;
  isLoading: boolean;
  fetchUsage: () => Promise<void>;
  submitAnalysis: (data: CreateAnalysisRequest) => Promise<string>;
  resetError: () => void;
}

const AnalysisNewContext = createContext<AnalysisNewContextValue | null>(null);

// Reducer
const initialState: AnalysisNewState = {
  usageInfo: null,
  isLoadingUsage: false,
  usageError: null,
  isSubmitting: false,
  submitError: null,
};

function analysisNewReducer(
  state: AnalysisNewState,
  action: AnalysisNewAction
): AnalysisNewState {
  switch (action.type) {
    case 'FETCH_USAGE_START':
      return { ...state, isLoadingUsage: true, usageError: null };
    case 'FETCH_USAGE_SUCCESS':
      return { ...state, isLoadingUsage: false, usageInfo: action.payload, usageError: null };
    case 'FETCH_USAGE_ERROR':
      return { ...state, isLoadingUsage: false, usageError: action.payload };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, submitError: null };
    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false, submitError: null };
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, submitError: action.payload };
    case 'RESET_ERROR':
      return { ...state, submitError: null, usageError: null };
    default:
      return state;
  }
}

// Provider
export function AnalysisNewProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(analysisNewReducer, initialState);
  const router = useRouter();

  // React Query: 사용량 조회
  const { refetch: refetchUsage } = useQuery({
    queryKey: ['analysis', 'usage'],
    queryFn: async () => {
      const response = await apiClient.get<UsageResponse>('/api/analyses/usage');
      return response;
    },
    onSuccess: (data) => {
      dispatch({
        type: 'FETCH_USAGE_SUCCESS',
        payload: {
          subscriptionTier: data.subscriptionTier,
          used: data.used,
          limit: data.limit,
          remaining: data.remaining,
          nextResetDate: data.nextResetDate ? new Date(data.nextResetDate) : undefined,
        },
      });
    },
    onError: (error) => {
      dispatch({ type: 'FETCH_USAGE_ERROR', payload: error as Error });
    },
    staleTime: 5 * 60 * 1000, // 5분
    refetchOnWindowFocus: true,
  });

  // React Query: 분석 요청
  const analysisMutation = useMutation({
    mutationFn: async (data: CreateAnalysisRequest) => {
      const response = await apiClient.post<AnalysisResponse>('/api/analyses', data);
      return response;
    },
  });

  // 액션 함수
  const fetchUsage = async () => {
    dispatch({ type: 'FETCH_USAGE_START' });
    await refetchUsage();
  };

  const submitAnalysis = async (data: CreateAnalysisRequest): Promise<string> => {
    dispatch({ type: 'SUBMIT_START' });
    try {
      const result = await analysisMutation.mutateAsync(data);
      dispatch({ type: 'SUBMIT_SUCCESS' });

      // 사용량 갱신
      await refetchUsage();

      return result.id;
    } catch (error) {
      const message = extractApiErrorMessage(error, '분석 요청 중 오류가 발생했습니다');
      dispatch({ type: 'SUBMIT_ERROR', payload: message });
      throw error;
    }
  };

  const resetError = () => {
    dispatch({ type: 'RESET_ERROR' });
  };

  // 파생 데이터
  const canSubmit = Boolean(
    state.usageInfo && state.usageInfo.remaining > 0 && !state.isSubmitting
  );
  const usageExceeded = state.usageInfo?.remaining === 0;
  const isLoading = state.isLoadingUsage || state.isSubmitting;

  const value: AnalysisNewContextValue = {
    state,
    dispatch,
    canSubmit,
    usageExceeded,
    isLoading,
    fetchUsage,
    submitAnalysis,
    resetError,
  };

  return (
    <AnalysisNewContext.Provider value={value}>
      {children}
    </AnalysisNewContext.Provider>
  );
}

export const useAnalysisNew = () => {
  const context = useContext(AnalysisNewContext);
  if (!context) {
    throw new Error('useAnalysisNew must be used within AnalysisNewProvider');
  }
  return context;
};
```

---

### 3.2 컴포넌트 구현

#### 3.2.1 메인 페이지 컴포넌트

**파일 위치**: `src/features/analysis/components/analysis-new-page.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useAnalysisNew } from '../context/analysis-new-context';
import { UsageDisplay } from './usage-display';
import { AnalysisForm } from './analysis-form';
import { ErrorAlert } from './error-alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { APP_CONFIG } from '@/constants/app';

export function AnalysisNewPage() {
  const { fetchUsage, state } = useAnalysisNew();
  const router = useRouter();

  useEffect(() => {
    fetchUsage();
  }, []);

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      {/* 상단 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(APP_CONFIG.routes.dashboard)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          대시보드로
        </Button>
        <h1 className="text-3xl font-bold">새 분석하기</h1>
        <p className="text-muted-foreground mt-2">
          AI가 당신의 사주를 분석합니다
        </p>
      </div>

      {/* 사용량 표시 */}
      <UsageDisplay />

      {/* 에러 표시 */}
      {state.usageError && (
        <ErrorAlert
          message="사용량 정보를 불러오지 못했습니다"
          onRetry={fetchUsage}
        />
      )}

      {state.submitError && (
        <ErrorAlert message={state.submitError} />
      )}

      {/* 분석 폼 */}
      <Card className="p-6 mt-6">
        <AnalysisForm />
      </Card>
    </div>
  );
}
```

#### 3.2.2 사용량 표시 컴포넌트

**파일 위치**: `src/features/analysis/components/usage-display.tsx`

```typescript
'use client';

import { useAnalysisNew } from '../context/analysis-new-context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils/date';
import { Skeleton } from '@/components/ui/skeleton';

export function UsageDisplay() {
  const { state, usageExceeded } = useAnalysisNew();

  if (state.isLoadingUsage) {
    return (
      <Card className="p-4">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </Card>
    );
  }

  if (!state.usageInfo) {
    return null;
  }

  const { used, limit, remaining, subscriptionTier, nextResetDate } = state.usageInfo;

  return (
    <Card className="p-4 border-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">
                남은 분석 횟수: {remaining}/{limit}회
              </span>
              <Badge variant={subscriptionTier === 'pro' ? 'default' : 'secondary'}>
                {subscriptionTier === 'pro' ? 'Pro' : '무료'}
              </Badge>
            </div>
            {nextResetDate && subscriptionTier === 'pro' && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Calendar className="w-3 h-3" />
                <span>다음 초기화: {formatDate(nextResetDate, 'yyyy-MM-dd')}</span>
              </div>
            )}
            {usageExceeded && (
              <p className="text-sm text-destructive mt-1">
                {subscriptionTier === 'free'
                  ? '무료 체험 1회를 모두 사용하였습니다'
                  : '이번 달 분석 횟수를 모두 사용하였습니다'}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
```

#### 3.2.3 분석 폼 컴포넌트

**파일 위치**: `src/features/analysis/components/analysis-form.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useAnalysisNew } from '../context/analysis-new-context';
import { analysisRequestSchema, type AnalysisRequestInput } from '@/lib/validation/schemas';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingOverlay } from '@/components/common/loading-overlay';
import { APP_CONFIG, GENDER_LABELS } from '@/constants/app';
import { toast } from '@/hooks/use-toast';

export function AnalysisForm() {
  const { canSubmit, usageExceeded, submitAnalysis, state } = useAnalysisNew();
  const router = useRouter();

  const form = useForm<AnalysisRequestInput>({
    resolver: zodResolver(analysisRequestSchema),
    defaultValues: {
      birthDate: undefined,
      birthTime: undefined,
      birthTimeUnknown: false,
      isLunar: false,
      gender: undefined,
    },
  });

  const birthTimeUnknown = form.watch('birthTimeUnknown');

  const onSubmit = async (data: AnalysisRequestInput) => {
    try {
      const requestData = {
        birthDate: data.birthDate!.toISOString().split('T')[0],
        birthTime: data.birthTimeUnknown ? null : data.birthTime,
        isLunar: data.isLunar,
        gender: data.gender!,
      };

      const analysisId = await submitAnalysis(requestData);

      toast({
        title: '분석 완료',
        description: '사주 분석이 완료되었습니다',
      });

      router.push(APP_CONFIG.routes.analysisDetail(analysisId));
    } catch (error) {
      // 에러는 Context에서 처리됨
    }
  };

  return (
    <>
      {state.isSubmitting && <LoadingOverlay message="AI가 사주를 분석하고 있습니다..." />}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 생년월일 */}
          <FormField
            control={form.control}
            name="birthDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>생년월일 *</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={field.value ? field.value.toISOString().split('T')[0] : ''}
                    onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                    max={new Date().toISOString().split('T')[0]}
                    min="1900-01-01"
                    disabled={usageExceeded}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 출생 시간 */}
          <FormField
            control={form.control}
            name="birthTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>출생 시간</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    {...field}
                    disabled={birthTimeUnknown || usageExceeded}
                    placeholder="HH:MM"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 모름 체크박스 */}
          <FormField
            control={form.control}
            name="birthTimeUnknown"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked);
                      if (checked) {
                        form.setValue('birthTime', undefined);
                      }
                    }}
                    disabled={usageExceeded}
                  />
                </FormControl>
                <FormLabel className="!mt-0">출생 시간을 모릅니다</FormLabel>
              </FormItem>
            )}
          />

          {/* 양력/음력 */}
          <FormField
            control={form.control}
            name="isLunar"
            render={({ field }) => (
              <FormItem>
                <FormLabel>양력/음력 *</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={(value) => field.onChange(value === 'lunar')}
                    value={field.value ? 'lunar' : 'solar'}
                    disabled={usageExceeded}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="solar" id="solar" />
                      <label htmlFor="solar">양력</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="lunar" id="lunar" />
                      <label htmlFor="lunar">음력</label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 성별 */}
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>성별 *</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={usageExceeded}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="male" />
                      <label htmlFor="male">{GENDER_LABELS.male}</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="female" />
                      <label htmlFor="female">{GENDER_LABELS.female}</label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 제출 버튼 */}
          <Button
            type="submit"
            className="w-full"
            disabled={!canSubmit || usageExceeded}
            size="lg"
          >
            {usageExceeded ? '사용량 초과' : '분석하기'}
          </Button>

          {/* Pro 업그레이드 버튼 (무료 유저 사용량 초과 시) */}
          {usageExceeded && state.usageInfo?.subscriptionTier === 'free' && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(APP_CONFIG.routes.subscription)}
            >
              Pro로 업그레이드
            </Button>
          )}
        </form>
      </Form>
    </>
  );
}
```

#### 3.2.4 에러 알림 컴포넌트

**파일 위치**: `src/features/analysis/components/error-alert.tsx`

```typescript
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>오류</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            재시도
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

---

## 4. 공통 모듈 의존성

### 4.1 기존 공통 모듈 사용

본 페이지는 다음 공통 모듈을 활용합니다 (이미 구현됨):

- **인증 미들웨어**: `src/backend/middleware/auth.ts`
- **사용량 관리**: `src/backend/services/usage.ts`
- **Gemini 클라이언트**: `src/backend/integrations/gemini/client.ts`
- **폼 검증 스키마**: `src/lib/validation/schemas.ts`
- **날짜 유틸리티**: `src/lib/utils/date.ts`
- **API 클라이언트**: `src/lib/remote/api-client.ts`
- **React Query 설정**: `src/lib/query/config.ts`
- **로딩 오버레이**: `src/components/common/loading-overlay.tsx`
- **상수**: `src/constants/app.ts`

### 4.2 필요한 shadcn-ui 컴포넌트

다음 컴포넌트가 추가로 필요합니다:

```bash
npx shadcn@latest add radio-group
npx shadcn@latest add alert
npx shadcn@latest add skeleton
```

---

## 5. 파일 구조

```
src/
├── app/
│   └── (protected)/
│       └── analysis/
│           └── new/
│               └── page.tsx                    # 페이지 엔트리
│
├── features/
│   └── analysis/
│       ├── backend/
│       │   ├── route.ts                        # Hono 라우터
│       │   ├── service.ts                      # 비즈니스 로직
│       │   ├── schema.ts                       # Zod 스키마
│       │   └── error.ts                        # 에러 코드
│       ├── components/
│       │   ├── analysis-new-page.tsx           # 메인 페이지
│       │   ├── analysis-form.tsx               # 폼 컴포넌트
│       │   ├── usage-display.tsx               # 사용량 표시
│       │   └── error-alert.tsx                 # 에러 알림
│       ├── context/
│       │   └── analysis-new-context.tsx        # Context + Reducer
│       └── lib/
│           └── dto.ts                          # DTO 재노출 (필요시)
```

---

## 6. 구현 순서

### Phase 1: Backend 기반 (선행 필수)

1. **에러 코드 정의** (`error.ts`)
   - 의존성: 없음

2. **Zod 스키마 정의** (`schema.ts`)
   - 의존성: 공통 검증 스키마

3. **서비스 레이어 구현** (`service.ts`)
   - 의존성: 사용량 관리, Gemini 클라이언트

4. **API 라우트 구현** (`route.ts`)
   - 의존성: 인증 미들웨어, 서비스 레이어, 스키마

5. **Hono 앱에 라우트 등록** (`app.ts` 수정)
   - 의존성: API 라우트

### Phase 2: Frontend 구현

6. **Context 및 상태 관리** (`analysis-new-context.tsx`)
   - 의존성: React Query, API 클라이언트

7. **컴포넌트 구현** (병렬 가능)
   - `usage-display.tsx`
   - `error-alert.tsx`
   - `analysis-form.tsx`
   - `analysis-new-page.tsx`
   - 의존성: Context, shadcn-ui 컴포넌트

8. **페이지 엔트리** (`page.tsx`)
   - 의존성: Provider, 메인 페이지 컴포넌트

### Phase 3: 테스트 및 검증

9. **API 테스트**
   - 사용량 조회 정상 동작
   - 분석 요청 성공
   - 사용량 초과 에러
   - Gemini API 실패 처리

10. **UI 테스트**
    - 폼 검증 동작
    - 로딩 상태 표시
    - 에러 메시지 표시
    - 사용량 표시

---

## 7. 테스트 체크리스트

### 7.1 Backend 테스트

- [ ] `GET /api/analyses/usage` 정상 응답
- [ ] `POST /api/analyses` 성공 시 분석 ID 반환
- [ ] 사용량 초과 시 400 에러 반환
- [ ] Gemini API 실패 시 503 에러 반환 및 사용량 차감 안 됨
- [ ] 유효하지 않은 입력 시 400 에러 반환
- [ ] 인증 없이 요청 시 401 에러 반환

### 7.2 Frontend 테스트

- [ ] 페이지 마운트 시 사용량 자동 조회
- [ ] 사용량 표시 정상 렌더링
- [ ] 폼 검증 (필수 필드, 날짜 유효성)
- [ ] 분석 요청 성공 시 상세보기 페이지로 이동
- [ ] 사용량 초과 시 폼 비활성화 및 메시지 표시
- [ ] Pro 업그레이드 버튼 표시 (무료 유저 사용량 초과 시)
- [ ] 에러 발생 시 에러 메시지 표시 및 재시도 가능
- [ ] 로딩 오버레이 표시 (분석 중)

### 7.3 통합 테스트

- [ ] 무료 유저: 1회 분석 후 사용량 초과 확인
- [ ] Pro 유저: 10회 분석 후 사용량 초과 확인
- [ ] 구독 만료 유저: 분석 시도 시 만료 메시지 표시
- [ ] Gemini API 재시도 로직 동작 확인

---

## 8. 주의 사항

### 8.1 코드베이스 일관성

- 기존 패턴 준수 (Hono 라우터, Context + useReducer, shadcn-ui)
- DRY 원칙 준수 (공통 모듈 재사용)
- 타입 안전성 보장 (`any` 사용 금지)

### 8.2 에러 처리

- 모든 에러는 표준 에러 코드 사용
- 사용자 친화적인 메시지 제공
- 재시도 옵션 제공

### 8.3 보안

- 인증 미들웨어 필수 적용
- 사용자 입력 검증 (프론트엔드 + 백엔드)
- SQL Injection 방지 (Supabase 쿼리 빌더 사용)

### 8.4 성능

- React Query 캐싱 활용 (사용량 정보 5분간 유효)
- 불필요한 리렌더링 방지 (useCallback, useMemo)
- 낙관적 업데이트 (분석 완료 후 즉시 이동)

---

## 9. 완료 기준

다음 조건이 모두 충족되면 구현 완료로 간주합니다:

1. **API 정상 동작**
   - 사용량 조회 API 정상 응답
   - 분석 요청 API 정상 동작
   - 에러 케이스 모두 처리

2. **UI 정상 동작**
   - 폼 검증 정상 동작
   - 사용량 표시 정상 렌더링
   - 로딩 및 에러 상태 표시

3. **타입 에러 없음**
   - `npm run build` 성공

4. **테스트 체크리스트 모두 통과**

---

## 10. 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-10-27 | Claude Code | 초기 작성 |

---

## 11. 승인

- [ ] 프론트엔드 개발자
- [ ] 백엔드 개발자
- [ ] 제품 관리자
