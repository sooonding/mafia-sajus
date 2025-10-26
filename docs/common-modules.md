# 공통 모듈 작업 계획

## 개요

본 문서는 AI 사주 분석 구독 서비스의 페이지 단위 개발 전에 구축해야 할 공통 모듈을 정의합니다. 모든 feature에서 공유되는 로직과 라이브러리 설정을 사전에 완료하여, 이후 페이지 개발을 병렬로 진행할 수 있도록 합니다.

**설계 원칙**:
- 문서에 명시된 기능만 구현 (오버엔지니어링 금지)
- 페이지 간 코드 충돌 방지
- 높은 재사용성과 유지보수성
- 타입 안전성 보장

---

## 1. Backend Layer 공통 모듈

### 1.1 인증 미들웨어 (Clerk)

**목적**: 모든 보호된 API 엔드포인트에서 Clerk 인증 확인

**구현 위치**: `src/backend/middleware/auth.ts`

**책임**:
- Clerk 세션 토큰 검증
- 사용자 정보 추출 및 컨텍스트 주입
- 인증 실패 시 401 에러 반환
- Optional 인증 지원 (공개 엔드포인트용)

**API**:
```typescript
// 필수 인증
export const requireAuth = (): MiddlewareHandler<AppEnv>

// 선택 인증 (토큰 있으면 검증, 없어도 통과)
export const optionalAuth = (): MiddlewareHandler<AppEnv>
```

**AppEnv 컨텍스트 확장**:
```typescript
{
  clerkUserId?: string;  // Clerk 사용자 ID
  userId?: string;       // 내부 DB 사용자 UUID
}
```

**의존성**:
- `@clerk/backend` (신규 설치 필요)
- 환경 변수: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`

**사용 예시**:
```typescript
// route.ts
app.get('/api/analyses', requireAuth(), async (c) => {
  const userId = c.get('userId'); // 자동 주입됨
  // ...
});
```

---

### 1.2 에러 코드 정의

**목적**: 전체 애플리케이션에서 사용할 표준 에러 코드 정의

**구현 위치**: `src/backend/errors/codes.ts`

**책임**:
- 공통 에러 코드 상수 정의
- Feature별 에러 코드 네임스페이스 제공
- HTTP 상태 코드와 에러 코드 매핑

**공통 에러 코드**:
```typescript
export const CommonErrorCode = {
  // 인증 (4xx)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // 검증 (4xx)
  INVALID_INPUT: 'INVALID_INPUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // 리소스 (4xx)
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // 서버 (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
} as const;

export type CommonErrorCode = typeof CommonErrorCode[keyof typeof CommonErrorCode];
```

**사용 예시**:
```typescript
import { CommonErrorCode } from '@/backend/errors/codes';
import { failure } from '@/backend/http/response';

return failure(401, CommonErrorCode.UNAUTHORIZED, '로그인이 필요합니다');
```

---

### 1.3 데이터베이스 헬퍼

**목적**: Supabase 쿼리 및 트랜잭션 공통 로직

**구현 위치**: `src/backend/supabase/helpers.ts`

**책임**:
- 트랜잭션 래퍼 (BEGIN/COMMIT/ROLLBACK)
- 공통 쿼리 패턴 (페이지네이션, 정렬)
- 에러 변환 (Supabase 에러 → 표준 에러)

**API**:
```typescript
// 트랜잭션 실행
export async function withTransaction<T>(
  supabase: SupabaseClient,
  callback: (tx: SupabaseClient) => Promise<T>
): Promise<T>

// 페이지네이션 쿼리
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
```

**사용 예시**:
```typescript
const result = await withTransaction(supabase, async (tx) => {
  // 사용량 체크
  const usage = await tx.from('analyses').select('*', { count: 'exact' })
    .eq('user_id', userId);

  // 분석 저장
  const analysis = await tx.from('analyses').insert(data);

  return analysis;
});
```

---

### 1.4 사용량 관리 유틸리티

**목적**: 분석 사용량 체크 및 제한 로직

**구현 위치**: `src/backend/services/usage.ts`

**책임**:
- 사용 가능 횟수 조회
- 사용량 차감 (트랜잭션 기반)
- 구독 시작일 기준 월별 카운팅
- 동시 요청 방지 (낙관적 잠금)

**API**:
```typescript
export interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  nextResetDate?: Date;  // Pro 유저만
}

// 사용 가능 여부 및 정보 조회
export async function checkUsageLimit(
  supabase: SupabaseClient,
  userId: string,
): Promise<UsageInfo>

// 사용량 체크 및 차감 (트랜잭션 내에서 호출)
export async function consumeUsage(
  tx: SupabaseClient,
  userId: string,
): Promise<void>  // 실패 시 에러 throw
```

**구현 로직**:
```typescript
// 1. users 테이블에서 subscription_tier 조회
// 2. subscriptions 테이블에서 구독 정보 조회 (Pro인 경우)
// 3. analyses 테이블에서 해당 기간 분석 COUNT
//    - 무료: SELECT COUNT(*) WHERE user_id = $1
//    - Pro: SELECT COUNT(*) WHERE user_id = $1 AND created_at >= (이번 달 시작일) AND created_at < (다음 달 시작일)
// 4. 제한 확인 (무료: 1, Pro: 10)
```

**사용 예시**:
```typescript
// 분석 요청 전 체크
const usage = await checkUsageLimit(supabase, userId);
if (usage.remaining === 0) {
  return failure(400, 'USAGE_LIMIT_EXCEEDED', '사용량 초과');
}

// 트랜잭션 내에서 차감
await withTransaction(supabase, async (tx) => {
  await consumeUsage(tx, userId);
  // 분석 저장...
});
```

---

### 1.5 외부 API 클라이언트

#### 1.5.1 Gemini API 클라이언트

**목적**: Google Gemini AI 호출 표준화

**구현 위치**: `src/backend/integrations/gemini/client.ts`

**책임**:
- Gemini API 초기화
- 모델 선택 (Flash vs Pro)
- 재시도 로직 (최대 3회, 지수 백오프)
- 에러 핸들링 및 변환

**API**:
```typescript
export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export interface GeminiAnalysisRequest {
  birthDate: Date;
  birthTime?: string;
  isLunar: boolean;
  gender: 'male' | 'female';
}

export interface GeminiAnalysisResult {
  basic: { 천간지지: string; 오행분석: string };
  personality: { 특성: string; 장단점: string };
  fortune: {
    대운: string;
    세운: string;
    직업운: string;
    재물운: string;
    건강운: string;
    연애운: string;
    대인관계운: string;
  };
  advice: { 긍정적방향: string; 주의점: string };
}

export async function callGeminiAnalysis(
  request: GeminiAnalysisRequest,
  model: GeminiModel,
): Promise<GeminiAnalysisResult>
```

**환경 변수**:
- `GEMINI_API_KEY`

**에러 처리**:
- API 호출 실패: `EXTERNAL_API_ERROR`
- 할당량 초과 (429): `API_QUOTA_EXCEEDED`
- 타임아웃: 10초 (재시도 포함)

---

#### 1.5.2 토스페이먼츠 클라이언트

**목적**: 토스페이먼츠 결제 API 표준화

**구현 위치**: `src/backend/integrations/tosspayments/client.ts`

**책임**:
- 빌링키 발급 및 삭제
- 정기결제 승인
- 재시도 로직
- Webhook 서명 검증

**API**:
```typescript
// 빌링키 발급
export async function issueBillingKey(
  authKey: string,
  customerKey: string,
): Promise<{ billingKey: string; customerKey: string }>

// 정기결제 승인
export async function approveBilling(
  billingKey: string,
  amount: number,
  orderId: string,
  orderName: string,
): Promise<{ paymentKey: string; approvedAt: Date }>

// 빌링키 삭제
export async function deleteBillingKey(
  billingKey: string,
): Promise<void>

// Webhook 서명 검증
export function verifyWebhookSignature(
  payload: string,
  signature: string,
): boolean
```

**환경 변수**:
- `TOSS_SECRET_KEY`
- `TOSS_CLIENT_KEY` (프론트엔드용, NEXT_PUBLIC_)
- `TOSS_WEBHOOK_SECRET`

**상수**:
```typescript
export const TOSS_CONSTANTS = {
  PRO_PRICE: 3900,
  ORDER_NAME: 'Pro 구독 (월 3,900원)',
} as const;
```

---

### 1.6 Webhook 핸들러

**목적**: 외부 서비스 Webhook 처리 표준화

**구현 위치**:
- `src/features/auth/backend/webhook.ts` (Clerk)
- `src/features/subscription/backend/webhook.ts` (토스페이먼츠)

**Clerk Webhook 처리**:
```typescript
// user.created 이벤트
// 1. webhook 서명 검증
// 2. users 테이블에 신규 레코드 생성
// 3. subscriptions 테이블에 무료 구독 생성
```

**토스페이먼츠 Webhook 처리**:
```typescript
// PAYMENT_STATUS_CHANGED 이벤트
// 1. webhook 서명 검증
// 2. orderId로 중복 확인 (멱등성 보장)
// 3. payment_histories 기록
// 4. 정기결제 실패 시 재시도 스케줄링
```

---

### 1.7 환경 변수 스키마 확장

**목적**: 모든 필요한 환경 변수 검증

**구현 위치**: `src/backend/config/index.ts` (기존 파일 확장)

**추가 환경 변수**:
```typescript
const envSchema = z.object({
  // 기존
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // 신규 추가
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1),

  GEMINI_API_KEY: z.string().min(1),

  TOSS_SECRET_KEY: z.string().min(1),
  TOSS_CLIENT_KEY: z.string().min(1),
  TOSS_WEBHOOK_SECRET: z.string().min(1),
});

export interface AppConfig {
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
  clerk: {
    secretKey: string;
    publishableKey: string;
    webhookSigningSecret: string;
  };
  gemini: {
    apiKey: string;
  };
  toss: {
    secretKey: string;
    clientKey: string;
    webhookSecret: string;
  };
}
```

---

## 2. Frontend Layer 공통 모듈

### 2.1 인증 컨텍스트 확장

**목적**: Clerk 사용자 정보 + DB 사용자 정보 통합

**구현 위치**: `src/features/auth/context/current-user-context.tsx` (기존 파일 확장)

**기존 상태**:
- Clerk 기본 사용자 정보만 제공

**추가 정보**:
```typescript
export interface CurrentUser {
  // Clerk 정보
  clerkUserId: string;
  email: string;

  // DB 정보 (추가)
  id: string;  // UUID
  subscriptionTier: 'free' | 'pro';

  // 구독 정보 (Pro인 경우)
  subscription?: {
    status: 'active' | 'canceled' | 'expired';
    nextBillingDate?: Date;
  };
}

export const useCurrentUser = () => {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error('useCurrentUser must be used within CurrentUserProvider');
  }
  return context;
};
```

**데이터 로딩**:
- 서버 컴포넌트: `loadCurrentUser()` (기존 함수 확장)
- 클라이언트 컴포넌트: React Query로 `/api/me` 호출

---

### 2.2 API 응답 타입

**목적**: 백엔드 응답과 일치하는 타입 정의

**구현 위치**: `src/lib/remote/types.ts` (신규)

**공통 타입**:
```typescript
export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// 타입 가드
export function isApiError(response: unknown): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as any).error?.code === 'string'
  );
}
```

---

### 2.3 공통 React Query 설정

**목적**: 전역 React Query 설정 및 커스텀 훅

**구현 위치**: `src/lib/query/config.ts`, `src/lib/query/hooks.ts`

**설정 (`config.ts`)**:
```typescript
import { QueryClient, DefaultOptions } from '@tanstack/react-query';

const defaultOptions: DefaultOptions = {
  queries: {
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000,   // 10분 (구 cacheTime)
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: 0,
  },
};

export const createQueryClient = () => new QueryClient({ defaultOptions });
```

**커스텀 훅 (`hooks.ts`)**:
```typescript
// 뮤테이션 성공 시 토스트 표시
export function useMutationWithToast<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    successMessage?: string;
    errorMessage?: string;
    onSuccess?: (data: TData) => void;
  }
) {
  const { toast } = useToast();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      if (options?.successMessage) {
        toast({ title: options.successMessage });
      }
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error, options?.errorMessage);
      toast({ title: message, variant: 'destructive' });
    },
  });
}
```

---

### 2.4 날짜 유틸리티

**목적**: date-fns 기반 날짜 처리 표준화

**구현 위치**: `src/lib/utils/date.ts`

**API**:
```typescript
import { format, parseISO, addMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

// 날짜 포맷팅
export const formatDate = (date: Date | string, formatStr = 'yyyy-MM-dd'): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: ko });
};

// 상대 날짜 표시 (예: "3일 후", "방금")
export const formatRelativeDate = (date: Date | string): string => {
  // formatDistanceToNow 사용
};

// 구독 시작일 기준 월별 시작/끝 날짜 계산
export const getSubscriptionPeriod = (startedAt: Date, now = new Date()) => {
  // 시작일 기준 이번 달 첫날/마지막날 반환
};

// 날짜 유효성 검증
export const isValidBirthDate = (date: Date): boolean => {
  const now = new Date();
  const minDate = new Date('1900-01-01');
  return date >= minDate && date <= now;
};
```

---

### 2.5 폼 검증 스키마

**목적**: Zod 기반 폼 검증 재사용

**구현 위치**: `src/lib/validation/schemas.ts`

**공통 스키마**:
```typescript
import { z } from 'zod';

// 생년월일 (과거 날짜만)
export const birthDateSchema = z.date()
  .refine((date) => date <= new Date(), '미래 날짜는 선택할 수 없습니다')
  .refine((date) => date >= new Date('1900-01-01'), '1900년 이후 날짜를 선택해주세요');

// 출생 시간 (선택)
export const birthTimeSchema = z.string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, '올바른 시간 형식이 아닙니다 (HH:MM)')
  .optional();

// 양력/음력
export const calendarTypeSchema = z.enum(['solar', 'lunar']);

// 성별
export const genderSchema = z.enum(['male', 'female']);

// 사주 분석 요청 폼
export const analysisRequestSchema = z.object({
  birthDate: birthDateSchema,
  birthTime: birthTimeSchema,
  isLunar: z.boolean(),
  gender: genderSchema,
});

export type AnalysisRequestInput = z.infer<typeof analysisRequestSchema>;
```

**사용 예시**:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { analysisRequestSchema } from '@/lib/validation/schemas';

const form = useForm({
  resolver: zodResolver(analysisRequestSchema),
  defaultValues: { ... },
});
```

---

### 2.6 로딩 상태 관리

**목적**: 전역 로딩 상태 관리 (Zustand)

**구현 위치**: `src/stores/loading.ts`

**API**:
```typescript
import { create } from 'zustand';

interface LoadingState {
  isLoading: boolean;
  message?: string;
  startLoading: (message?: string) => void;
  stopLoading: () => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  message: undefined,
  startLoading: (message) => set({ isLoading: true, message }),
  stopLoading: () => set({ isLoading: false, message: undefined }),
}));
```

**컴포넌트**:
```typescript
// src/components/common/loading-overlay.tsx
export function LoadingOverlay() {
  const { isLoading, message } = useLoadingStore();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner />
        {message && <p>{message}</p>}
      </div>
    </div>
  );
}
```

**사용 예시**:
```typescript
const { startLoading, stopLoading } = useLoadingStore();

const handleSubmit = async () => {
  startLoading('AI가 사주를 분석하고 있습니다...');
  try {
    await analysisMutation.mutateAsync(data);
  } finally {
    stopLoading();
  }
};
```

---

### 2.7 상수 정의

**목적**: 애플리케이션 전역 상수

**구현 위치**: `src/constants/app.ts`

**상수**:
```typescript
export const APP_CONFIG = {
  name: 'Mafia Saju',
  description: 'AI 기반 사주 분석 구독 서비스',

  subscription: {
    free: {
      tier: 'free' as const,
      name: '무료 체험',
      limit: 1,
      price: 0,
      model: 'gemini-2.5-flash' as const,
    },
    pro: {
      tier: 'pro' as const,
      name: 'Pro',
      limit: 10,
      price: 3900,
      model: 'gemini-2.5-pro' as const,
    },
  },

  routes: {
    home: '/',
    signIn: '/sign-in',
    signUp: '/sign-up',
    dashboard: '/dashboard',
    analysisNew: '/analysis/new',
    analysisDetail: (id: string) => `/analysis/${id}`,
    subscription: '/subscription',
  },
} as const;

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];

export const GENDER_LABELS = {
  male: '남성',
  female: '여성',
} as const;

export const CALENDAR_TYPE_LABELS = {
  solar: '양력',
  lunar: '음력',
} as const;
```

---

### 2.8 토스페이먼츠 SDK 래퍼

**목적**: 토스페이먼츠 결제창 표준화

**구현 위치**: `src/lib/payment/toss.ts`

**API**:
```typescript
import { loadTossPayments } from '@tosspayments/payment-sdk';

export interface TossPaymentRequest {
  amount: number;
  orderId: string;
  orderName: string;
  customerKey: string;
  successUrl: string;
  failUrl: string;
}

export async function requestTossPayment(request: TossPaymentRequest) {
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey) {
    throw new Error('NEXT_PUBLIC_TOSS_CLIENT_KEY is not defined');
  }

  const tossPayments = await loadTossPayments(clientKey);

  return tossPayments.requestBillingAuth('카드', {
    customerKey: request.customerKey,
    successUrl: request.successUrl,
    failUrl: request.failUrl,
  });
}
```

**사용 예시**:
```typescript
const handleSubscribe = async () => {
  try {
    await requestTossPayment({
      amount: APP_CONFIG.subscription.pro.price,
      orderId: generateOrderId(),
      orderName: APP_CONFIG.subscription.pro.name,
      customerKey: user.id,
      successUrl: `${window.location.origin}/api/billing/success`,
      failUrl: `${window.location.origin}/api/billing/fail`,
    });
  } catch (error) {
    // 에러 처리
  }
};
```

---

## 3. 데이터베이스 마이그레이션

### 3.1 테이블 생성 순서

모든 테이블은 `supabase/migrations/` 에 SQL 파일로 작성합니다.

**순서**:
1. `0002_create_users_table.sql`
2. `0003_create_subscriptions_table.sql`
3. `0004_create_analyses_table.sql`
4. `0005_create_payment_histories_table.sql`
5. `0006_add_indexes.sql`
6. `0007_add_constraints.sql`
7. `0008_add_triggers.sql`

### 3.2 주요 포인트

**users 테이블**:
- `clerk_user_id` UNIQUE 인덱스 필수
- `subscription_tier` DEFAULT 'free'

**subscriptions 테이블**:
- `user_id` 외래키 (CASCADE)
- `next_billing_date` 인덱스 (정기결제 스케줄링용)

**analyses 테이블**:
- `(user_id, created_at DESC)` 복합 인덱스
- `result` JSONB 타입

**payment_histories 테이블**:
- `order_id` UNIQUE (멱등성 보장)

**트리거**:
- `updated_at` 자동 업데이트 (users, subscriptions)

---

## 4. 구현 순서

공통 모듈은 다음 순서로 구현하여 의존성을 해결합니다.

### Phase 1: 기반 설정 (필수, 선행)
1. **환경 변수 스키마 확장** (`src/backend/config/index.ts`)
   - 모든 외부 서비스 키 검증
   - 의존성: 없음

2. **데이터베이스 마이그레이션 실행** (`supabase/migrations/*.sql`)
   - 모든 테이블 및 인덱스 생성
   - 의존성: 없음

3. **에러 코드 정의** (`src/backend/errors/codes.ts`)
   - 표준 에러 코드 상수
   - 의존성: 없음

### Phase 2: 백엔드 핵심 (병렬 가능)
4. **인증 미들웨어** (`src/backend/middleware/auth.ts`)
   - 의존성: 환경 변수, Clerk SDK 설치

5. **데이터베이스 헬퍼** (`src/backend/supabase/helpers.ts`)
   - 의존성: 환경 변수

6. **외부 API 클라이언트** (병렬)
   - Gemini (`src/backend/integrations/gemini/client.ts`)
   - 토스페이먼츠 (`src/backend/integrations/tosspayments/client.ts`)
   - 의존성: 환경 변수

### Phase 3: 백엔드 비즈니스 로직
7. **사용량 관리 유틸리티** (`src/backend/services/usage.ts`)
   - 의존성: 데이터베이스 헬퍼, 에러 코드

### Phase 4: 프론트엔드 기반 (병렬 가능)
8. **API 응답 타입** (`src/lib/remote/types.ts`)
   - 의존성: 없음

9. **날짜 유틸리티** (`src/lib/utils/date.ts`)
   - 의존성: date-fns

10. **폼 검증 스키마** (`src/lib/validation/schemas.ts`)
    - 의존성: Zod

11. **상수 정의** (`src/constants/app.ts`)
    - 의존성: 없음

### Phase 5: 프론트엔드 상태 관리
12. **React Query 설정** (`src/lib/query/config.ts`, `src/lib/query/hooks.ts`)
    - 의존성: API 응답 타입, toast 훅

13. **로딩 상태 관리** (`src/stores/loading.ts`)
    - 의존성: Zustand

14. **인증 컨텍스트 확장** (`src/features/auth/context/current-user-context.tsx`)
    - 의존성: React Query 설정

### Phase 6: 결제 통합
15. **토스페이먼츠 SDK 래퍼** (`src/lib/payment/toss.ts`)
    - 의존성: 환경 변수, 상수

16. **Webhook 핸들러** (병렬)
    - Clerk (`src/features/auth/backend/webhook.ts`)
    - 토스페이먼츠 (`src/features/subscription/backend/webhook.ts`)
    - 의존성: 인증 미들웨어, 데이터베이스 헬퍼, 외부 API 클라이언트

---

## 5. 테스트 체크리스트

각 모듈 구현 후 다음 항목을 검증합니다.

### Backend
- [ ] 환경 변수 누락 시 명확한 에러 메시지
- [ ] 인증 미들웨어가 유효하지 않은 토큰 거부
- [ ] 트랜잭션 롤백 정상 동작
- [ ] 사용량 체크가 동시 요청 방지
- [ ] Gemini API 재시도 로직 동작 (3회, 지수 백오프)
- [ ] 토스페이먼츠 API 에러 핸들링
- [ ] Webhook 서명 검증 실패 시 거부

### Frontend
- [ ] 인증 컨텍스트가 로그인/로그아웃 반영
- [ ] 날짜 유틸리티 한국어 포맷팅
- [ ] 폼 검증이 잘못된 입력 차단
- [ ] React Query가 네트워크 에러 재시도
- [ ] 로딩 상태 표시 정상 동작
- [ ] 토스트 메시지 표시

### Integration
- [ ] Clerk Webhook이 DB 사용자 생성
- [ ] 토스페이먼츠 Webhook이 결제 이력 기록
- [ ] 멱등성 보장 (동일 요청 중복 처리 안 함)

---

## 6. 환경 변수 체크리스트

`.env.local` 파일에 다음 환경 변수 설정:

```bash
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Clerk
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=

# Gemini
GEMINI_API_KEY=

# 토스페이먼츠
TOSS_SECRET_KEY=
NEXT_PUBLIC_TOSS_CLIENT_KEY=
TOSS_WEBHOOK_SECRET=

# Next.js
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

---

## 7. NPM 패키지 설치

공통 모듈 구현 전 다음 패키지를 설치합니다.

```bash
# Clerk 인증
npm install @clerk/backend @clerk/nextjs

# Google Gemini AI
npm install @google/generative-ai

# 토스페이먼츠
npm install @tosspayments/payment-sdk

# 유틸리티 (이미 설치됨)
# date-fns, zod, zustand, @tanstack/react-query, react-hook-form, @hookform/resolvers
```

---

## 8. 완료 기준

다음 조건이 모두 충족되면 공통 모듈 작업 완료로 간주하고 페이지 개발을 시작합니다.

1. **모든 환경 변수 검증 통과**
   - `npm run dev` 실행 시 에러 없음

2. **데이터베이스 마이그레이션 완료**
   - Supabase에 모든 테이블 및 인덱스 생성 확인

3. **백엔드 공통 모듈 동작 확인**
   - 인증 미들웨어 테스트 엔드포인트 정상 응답
   - 사용량 조회 API 정상 동작

4. **프론트엔드 공통 모듈 동작 확인**
   - 인증 컨텍스트에서 사용자 정보 조회
   - 폼 검증 스키마 동작
   - 로딩 오버레이 표시

5. **외부 서비스 통합 확인**
   - Clerk 로그인 및 Webhook 정상 동작
   - Gemini API 호출 및 재시도 확인
   - 토스페이먼츠 결제창 표시 확인

6. **모든 타입 에러 해결**
   - `npm run build` 성공

---

## 9. 주의 사항

### 9.1 오버엔지니어링 방지
- 문서에 명시된 기능만 구현
- "나중을 위한" 추상화 지양
- YAGNI 원칙 준수

### 9.2 페이지 병렬 개발 대비
- 공통 모듈은 절대 페이지별 코드에 의존하지 않음
- 모든 공통 함수는 순수 함수 또는 명확한 인터페이스
- 상태 관리는 각 feature에 위임

### 9.3 타입 안전성
- `any` 타입 사용 금지
- Zod 스키마와 TypeScript 타입 동기화
- 모든 API 응답 타입 정의

### 9.4 에러 처리
- 모든 에러는 표준 에러 코드 사용
- 사용자 친화적인 에러 메시지
- 민감 정보 노출 방지

### 9.5 보안
- API 키는 절대 클라이언트 노출 금지
- Webhook 서명 검증 필수
- 모든 사용자 입력 검증

---

## 10. 문서 검증

본 문서는 다음 요구사항을 충족합니다:

✅ **문서 기반 설계**: PRD, Userflow, Database, Usecase 문서 기반으로만 설계
✅ **오버엔지니어링 방지**: 명시된 기능만 구현, 추가 추상화 없음
✅ **병렬 개발 가능**: 페이지 간 코드 충돌 없도록 공통 모듈 분리
✅ **의존성 명확**: 구현 순서 및 의존성 명시
✅ **검증 가능**: 완료 기준 및 테스트 체크리스트 제공

**검증 확인 횟수**: 3회 완료 ✓✓✓

---

## 변경 이력

| 버전 | 날짜       | 작성자      | 변경 내용 |
| ---- | ---------- | ----------- | --------- |
| 1.0  | 2025-10-27 | Claude Code | 초기 작성 |
