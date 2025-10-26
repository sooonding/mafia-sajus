# 구독 관리 페이지 (/subscription) 구현 계획

## 페이지 정보

- **경로**: `/subscription`
- **접근 권한**: 인증 필요
- **목적**: 구독 상태 확인 및 결제 관리 (구독/취소/재개)
- **관련 문서**:
  - PRD 섹션 3.2.6
  - Userflow 섹션 2, 5
  - UC-002 (Pro 구독 결제)
  - UC-005 (구독 관리)
  - 상태관리 설계: `/docs/pages/5-subscription/state.md`

---

## 1. 구현 개요

### 1.1 핵심 기능

1. **무료 유저**: Pro 요금제 안내 및 구독 시작
2. **Pro 활성 유저**: 구독 정보 조회 및 취소
3. **취소 예정 유저**: 구독 재개 옵션 제공
4. **결제 이력 조회**: 과거 결제 내역 확인

### 1.2 주요 사용자 플로우

```
[무료 유저]
구독 관리 페이지 접속
  → Pro 요금제 안내 확인
  → Pro 구독하기 버튼 클릭
  → 토스페이먼츠 결제창
  → 카드 정보 입력 및 결제
  → 성공 모달 표시
  → 대시보드 리다이렉트

[Pro 활성 유저]
구독 관리 페이지 접속
  → 구독 정보 및 사용 현황 확인
  → 결제 이력 조회
  → (선택) 구독 취소 버튼 클릭
  → 확인 모달 (만료일까지 혜택 유지 안내)
  → 취소 확인
  → 취소 예정 상태로 변경

[취소 예정 유저]
구독 관리 페이지 접속
  → 만료일 및 남은 혜택 확인
  → (선택) 구독 재개 버튼 클릭
  → 확인 모달 (정기결제 재시작 안내)
  → 재개 확인
  → Pro 활성 상태로 복귀
```

---

## 2. 페이지 구조 및 컴포넌트 설계

### 2.1 파일 구조

```
src/
├── app/
│   └── subscription/
│       └── page.tsx                          # 페이지 엔트리 (Client Component)
│
└── features/
    └── subscription/
        ├── components/
        │   ├── subscription-content.tsx      # 메인 컨텐츠 (상태별 분기)
        │   ├── free-user-view.tsx            # 무료 유저 뷰
        │   ├── pro-active-view.tsx           # Pro 활성 유저 뷰
        │   ├── canceled-view.tsx             # 취소 예정 유저 뷰
        │   ├── expired-view.tsx              # 만료 유저 뷰
        │   ├── subscription-info-card.tsx    # 구독 정보 카드
        │   ├── usage-card.tsx                # 사용 현황 카드
        │   ├── pro-plan-card.tsx             # Pro 요금제 안내 카드
        │   ├── payment-method-card.tsx       # 결제 수단 카드
        │   ├── payment-history-list.tsx      # 결제 이력 리스트
        │   ├── subscribe-button.tsx          # Pro 구독하기 버튼
        │   ├── cancel-button.tsx             # 구독 취소 버튼
        │   ├── resume-button.tsx             # 구독 재개 버튼
        │   ├── cancel-confirm-modal.tsx      # 구독 취소 확인 모달
        │   ├── resume-confirm-modal.tsx      # 구독 재개 확인 모달
        │   ├── payment-success-modal.tsx     # 결제 성공 모달
        │   └── payment-error-modal.tsx       # 결제 실패 모달
        │
        ├── context/
        │   └── subscription-context.tsx      # 상태 관리 Context (useReducer)
        │
        ├── hooks/
        │   ├── useSubscriptionQuery.ts       # 구독 정보 조회
        │   ├── useUsageQuery.ts              # 사용량 조회
        │   ├── usePaymentHistoriesQuery.ts   # 결제 이력 조회
        │   ├── useSubscribeMutation.ts       # Pro 구독 Mutation
        │   ├── useCancelMutation.ts          # 구독 취소 Mutation
        │   └── useResumeMutation.ts          # 구독 재개 Mutation
        │
        ├── backend/
        │   ├── route.ts                      # Hono 라우터 정의
        │   ├── service.ts                    # 비즈니스 로직 (Supabase)
        │   ├── schema.ts                     # Zod 스키마 (요청/응답)
        │   ├── error.ts                      # 에러 코드 정의
        │   └── webhook.ts                    # 토스페이먼츠 Webhook 핸들러
        │
        └── lib/
            └── dto.ts                        # 프론트엔드용 타입 재노출
```

---

### 2.2 컴포넌트 계층 구조

```
SubscriptionPage (page.tsx)
└── SubscriptionProvider (Context)
    └── SubscriptionContent
        ├── [무료 유저 뷰]
        │   ├── CurrentStatusCard
        │   ├── ProPlanCard
        │   └── SubscribeButton
        │
        ├── [Pro 활성 유저 뷰]
        │   ├── SubscriptionInfoCard
        │   ├── UsageCard
        │   ├── PaymentMethodCard
        │   ├── PaymentHistoryList
        │   └── CancelButton
        │
        ├── [취소 예정 유저 뷰]
        │   ├── SubscriptionInfoCard (강조 스타일)
        │   ├── UsageCard (만료 안내)
        │   └── ResumeButton
        │
        ├── [만료 유저 뷰]
        │   ├── ExpiredNotice
        │   └── SubscribeButton
        │
        └── [공통 모달]
            ├── CancelConfirmModal
            ├── ResumeConfirmModal
            ├── PaymentSuccessModal
            └── PaymentErrorModal
```

---

## 3. 백엔드 API 설계

### 3.1 API 엔드포인트

| 메서드 | 경로 | 설명 | 인증 | 요청 | 응답 |
|--------|------|------|------|------|------|
| GET | `/api/subscription` | 구독 정보 조회 | 필수 | - | `Subscription \| null` |
| GET | `/api/usage` | 사용량 정보 조회 | 필수 | - | `UsageInfo` |
| GET | `/api/payment-histories` | 결제 이력 조회 | 필수 | `?page=1&limit=10` | `PaymentHistory[]` |
| POST | `/api/subscription/subscribe` | Pro 구독 시작 | 필수 | `{ authKey: string }` | `{ success: true }` |
| POST | `/api/subscription/cancel` | 구독 취소 | 필수 | `{ reason?: string }` | `{ status: 'canceled', nextBillingDate: Date }` |
| POST | `/api/subscription/resume` | 구독 재개 | 필수 | - | `{ status: 'active', nextBillingDate: Date }` |
| POST | `/api/webhooks/tosspayments` | 토스페이먼츠 Webhook | - | Webhook payload | `200 OK` |

---

### 3.2 Zod 스키마 정의

**파일**: `src/features/subscription/backend/schema.ts`

```typescript
import { z } from 'zod';

// 구독 정보 스키마
export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  plan: z.enum(['free', 'pro']),
  status: z.enum(['active', 'canceled', 'expired']),
  billingKey: z.string().optional(),
  customerKey: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  nextBillingDate: z.string().datetime().optional(),
  canceledAt: z.string().datetime().optional(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

// 사용량 정보 스키마
export const usageInfoSchema = z.object({
  used: z.number().int().min(0),
  limit: z.number().int().min(1),
  remaining: z.number().int().min(0),
  nextResetDate: z.string().datetime().optional(),
});

export type UsageInfo = z.infer<typeof usageInfoSchema>;

// 결제 이력 스키마
export const paymentHistorySchema = z.object({
  id: z.string().uuid(),
  paymentKey: z.string(),
  orderId: z.string(),
  amount: z.number().int().min(0),
  status: z.enum(['DONE', 'ABORTED', 'CANCELED']),
  paidAt: z.string().datetime(),
});

export type PaymentHistory = z.infer<typeof paymentHistorySchema>;

// Pro 구독 요청 스키마
export const subscribeRequestSchema = z.object({
  authKey: z.string().min(1, '인증 키가 필요합니다'),
});

export type SubscribeRequest = z.infer<typeof subscribeRequestSchema>;

// 구독 취소 요청 스키마
export const cancelRequestSchema = z.object({
  reason: z.string().optional(),
});

export type CancelRequest = z.infer<typeof cancelRequestSchema>;

// 구독 재개 요청 스키마
export const resumeRequestSchema = z.object({});

export type ResumeRequest = z.infer<typeof resumeRequestSchema>;
```

---

### 3.3 에러 코드 정의

**파일**: `src/features/subscription/backend/error.ts`

```typescript
export const SubscriptionErrorCode = {
  // 구독 상태 에러
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_ALREADY_ACTIVE: 'SUBSCRIPTION_ALREADY_ACTIVE',
  SUBSCRIPTION_ALREADY_CANCELED: 'SUBSCRIPTION_ALREADY_CANCELED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_NOT_ACTIVE: 'SUBSCRIPTION_NOT_ACTIVE',

  // 결제 에러
  BILLING_KEY_ISSUE_FAILED: 'BILLING_KEY_ISSUE_FAILED',
  PAYMENT_APPROVAL_FAILED: 'PAYMENT_APPROVAL_FAILED',
  BILLING_KEY_DELETE_FAILED: 'BILLING_KEY_DELETE_FAILED',

  // 외부 API 에러
  TOSSPAYMENTS_API_ERROR: 'TOSSPAYMENTS_API_ERROR',
} as const;

export type SubscriptionErrorCode = typeof SubscriptionErrorCode[keyof typeof SubscriptionErrorCode];
```

---

### 3.4 서비스 로직 구현

**파일**: `src/features/subscription/backend/service.ts`

주요 함수:

```typescript
// 구독 정보 조회
export async function getSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<Subscription | null>

// 사용량 정보 조회 (공통 모듈 사용)
export async function getUsageInfo(
  supabase: SupabaseClient,
  userId: string
): Promise<UsageInfo>

// 결제 이력 조회 (페이지네이션)
export async function getPaymentHistories(
  supabase: SupabaseClient,
  userId: string,
  page: number,
  limit: number
): Promise<PaymentHistory[]>

// Pro 구독 시작
export async function createProSubscription(
  supabase: SupabaseClient,
  userId: string,
  authKey: string
): Promise<void>

// 구독 취소
export async function cancelSubscription(
  supabase: SupabaseClient,
  userId: string,
  reason?: string
): Promise<{ nextBillingDate: Date }>

// 구독 재개
export async function resumeSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<{ nextBillingDate: Date }>
```

**구현 세부사항**:

1. **getSubscription**:
   - `subscriptions` 테이블에서 `user_id` 기준 조회
   - `status IN ('active', 'canceled')` 인 것만 반환
   - 없으면 `null` 반환

2. **createProSubscription**:
   - 트랜잭션 시작
   - 토스페이먼츠 빌링키 발급 (공통 모듈 사용)
   - 첫 결제 승인 (3,900원)
   - `users` 테이블: `subscription_tier='pro'` 업데이트
   - `subscriptions` 테이블: 신규 레코드 생성
   - `payment_histories` 테이블: 첫 결제 기록 추가
   - 트랜잭션 커밋
   - 실패 시 롤백 및 빌링키 삭제

3. **cancelSubscription**:
   - 활성 구독 확인 (`status='active'`)
   - `subscriptions` 테이블: `status='canceled'`, `canceled_at=now()` 업데이트
   - 토스페이먼츠 빌링키 삭제 예약 (next_billing_date 이후)
   - 취소 사유 로깅
   - `nextBillingDate` 반환

4. **resumeSubscription**:
   - 취소 예정 구독 확인 (`status='canceled'`, `next_billing_date > now`)
   - `subscriptions` 테이블: `status='active'`, `canceled_at=NULL` 업데이트
   - 토스페이먼츠 빌링키 삭제 예약 취소
   - `nextBillingDate` 반환

---

### 3.5 Hono 라우터 구현

**파일**: `src/features/subscription/backend/route.ts`

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '@/backend/middleware/auth';
import { success, failure } from '@/backend/http/response';
import {
  subscribeRequestSchema,
  cancelRequestSchema,
  resumeRequestSchema,
} from './schema';
import {
  getSubscription,
  getUsageInfo,
  getPaymentHistories,
  createProSubscription,
  cancelSubscription,
  resumeSubscription,
} from './service';
import { SubscriptionErrorCode } from './error';
import { CommonErrorCode } from '@/backend/errors/codes';
import { AppEnv } from '@/backend/hono/context';

const app = new Hono<AppEnv>();

// GET /api/subscription - 구독 정보 조회
app.get('/', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const supabase = c.get('supabase');

  const subscription = await getSubscription(supabase, userId);

  return success(c, subscription);
});

// GET /api/usage - 사용량 정보 조회
app.get('/usage', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const supabase = c.get('supabase');

  const usageInfo = await getUsageInfo(supabase, userId);

  return success(c, usageInfo);
});

// GET /api/payment-histories - 결제 이력 조회
app.get('/payment-histories', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const supabase = c.get('supabase');

  const page = parseInt(c.req.query('page') ?? '1', 10);
  const limit = parseInt(c.req.query('limit') ?? '10', 10);

  const histories = await getPaymentHistories(supabase, userId, page, limit);

  return success(c, histories);
});

// POST /api/subscription/subscribe - Pro 구독 시작
app.post('/subscribe', requireAuth(), zValidator('json', subscribeRequestSchema), async (c) => {
  const userId = c.get('userId');
  const supabase = c.get('supabase');
  const { authKey } = c.req.valid('json');

  try {
    await createProSubscription(supabase, userId, authKey);
    return success(c, { message: 'Pro 구독이 시작되었습니다' });
  } catch (error: any) {
    if (error.code === SubscriptionErrorCode.SUBSCRIPTION_ALREADY_ACTIVE) {
      return failure(c, 400, error.code, error.message);
    }
    throw error;
  }
});

// POST /api/subscription/cancel - 구독 취소
app.post('/cancel', requireAuth(), zValidator('json', cancelRequestSchema), async (c) => {
  const userId = c.get('userId');
  const supabase = c.get('supabase');
  const { reason } = c.req.valid('json');

  try {
    const result = await cancelSubscription(supabase, userId, reason);
    return success(c, {
      status: 'canceled',
      nextBillingDate: result.nextBillingDate,
      message: '구독이 취소되었습니다',
    });
  } catch (error: any) {
    if (error.code === SubscriptionErrorCode.SUBSCRIPTION_NOT_ACTIVE) {
      return failure(c, 400, error.code, error.message);
    }
    throw error;
  }
});

// POST /api/subscription/resume - 구독 재개
app.post('/resume', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const supabase = c.get('supabase');

  try {
    const result = await resumeSubscription(supabase, userId);
    return success(c, {
      status: 'active',
      nextBillingDate: result.nextBillingDate,
      message: '구독이 재개되었습니다',
    });
  } catch (error: any) {
    if (error.code === SubscriptionErrorCode.SUBSCRIPTION_EXPIRED) {
      return failure(c, 400, error.code, error.message);
    }
    throw error;
  }
});

export function registerSubscriptionRoutes(hono: Hono<AppEnv>) {
  hono.route('/api/subscription', app);
}
```

---

### 3.6 Webhook 핸들러 구현

**파일**: `src/features/subscription/backend/webhook.ts`

```typescript
import { Hono } from 'hono';
import { AppEnv } from '@/backend/hono/context';
import { verifyWebhookSignature } from '@/backend/integrations/tosspayments/client';

const app = new Hono<AppEnv>();

// POST /api/webhooks/tosspayments - 토스페이먼츠 Webhook
app.post('/tosspayments', async (c) => {
  const payload = await c.req.text();
  const signature = c.req.header('X-Toss-Signature');

  if (!signature || !verifyWebhookSignature(payload, signature)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const event = JSON.parse(payload);
  const supabase = c.get('supabase');

  // 이벤트 타입별 처리
  switch (event.eventType) {
    case 'PAYMENT_STATUS_CHANGED':
      await handlePaymentStatusChanged(supabase, event);
      break;
    default:
      console.log('Unknown event type:', event.eventType);
  }

  return c.json({ success: true });
});

async function handlePaymentStatusChanged(supabase: SupabaseClient, event: any) {
  const { orderId, status, paymentKey, amount, approvedAt } = event.data;

  // 중복 확인 (멱등성 보장)
  const { data: existing } = await supabase
    .from('payment_histories')
    .select('id')
    .eq('order_id', orderId)
    .single();

  if (existing) {
    console.log('Duplicate webhook:', orderId);
    return;
  }

  // payment_histories 기록
  await supabase.from('payment_histories').insert({
    payment_key: paymentKey,
    order_id: orderId,
    amount,
    status,
    paid_at: approvedAt,
  });

  // 결제 실패 처리
  if (status === 'ABORTED') {
    // 재시도 스케줄링 로직 (향후 구현)
    console.log('Payment failed, scheduling retry:', orderId);
  }
}

export function registerWebhookRoutes(hono: Hono<AppEnv>) {
  hono.route('/api/webhooks', app);
}
```

---

## 4. 프론트엔드 구현

### 4.1 상태 관리 (Context + useReducer)

**파일**: `src/features/subscription/context/subscription-context.tsx`

**구조**: `/docs/pages/5-subscription/state.md` 참고

주요 구현:

```typescript
'use client';

import React, { createContext, useContext, useReducer, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInDays } from 'date-fns';
import { apiClient } from '@/lib/remote/api-client';
import { APP_CONFIG } from '@/constants/app';
import { requestTossPayment } from '@/lib/payment/toss';
import { generateOrderId } from '@/lib/utils/order';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { toast } from '@/hooks/use-toast';

// State, Action, Reducer 정의 (state.md 참고)
// ...

// Context Value 정의
interface SubscriptionContextValue {
  subscription: Subscription | null;
  usageInfo: UsageInfo | null;
  paymentHistories: PaymentHistory[];
  isLoadingSubscription: boolean;
  isLoadingUsage: boolean;
  isLoadingHistories: boolean;

  state: SubscriptionPageState;
  dispatch: React.Dispatch<SubscriptionPageAction>;

  subscriptionTier: 'free' | 'pro';
  isProActive: boolean;
  isCanceled: boolean;
  isExpired: boolean;
  canCancel: boolean;
  canResume: boolean;
  daysUntilExpiry: number | null;

  handleSubscribe: () => Promise<void>;
  handleCancel: () => Promise<void>;
  handleResume: () => Promise<void>;
  openCancelModal: () => void;
  closeCancelModal: () => void;
  openResumeModal: () => void;
  closeResumeModal: () => void;
  setCancelReason: (reason: string | null) => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(subscriptionPageReducer, initialState);
  const queryClient = useQueryClient();
  const user = useCurrentUser();

  // React Query - 구독 정보
  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await apiClient.get('/api/subscription');
      return res.data;
    },
  });

  // React Query - 사용량 정보
  const { data: usageInfo, isLoading: isLoadingUsage } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const res = await apiClient.get('/api/usage');
      return res.data;
    },
  });

  // React Query - 결제 이력
  const { data: paymentHistories = [], isLoading: isLoadingHistories } = useQuery({
    queryKey: ['payment-histories'],
    queryFn: async () => {
      const res = await apiClient.get('/api/payment-histories');
      return res.data;
    },
  });

  // Mutation - Pro 구독
  const handleSubscribe = async () => {
    dispatch({ type: 'PAYMENT_START' });

    try {
      await requestTossPayment({
        amount: APP_CONFIG.subscription.pro.price,
        orderId: generateOrderId(),
        orderName: APP_CONFIG.subscription.pro.name,
        customerKey: user.id,
        successUrl: `${window.location.origin}/api/billing/success`,
        failUrl: `${window.location.origin}/api/billing/fail`,
      });
    } catch (error: any) {
      dispatch({ type: 'PAYMENT_ERROR', payload: { error: error.message } });
    }
  };

  // Mutation - 구독 취소
  const cancelMutation = useMutation({
    mutationFn: async (reason?: string) => {
      return apiClient.post('/api/subscription/cancel', { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({ title: '구독이 취소되었습니다' });
    },
    onError: (error: any) => {
      toast({
        title: '구독 취소에 실패했습니다',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCancel = async () => {
    await cancelMutation.mutateAsync(state.selectedReason ?? undefined);
    dispatch({ type: 'CLOSE_CANCEL_MODAL' });
  };

  // Mutation - 구독 재개
  const resumeMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/api/subscription/resume');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({ title: '구독이 재개되었습니다' });
    },
    onError: (error: any) => {
      toast({
        title: '구독 재개에 실패했습니다',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleResume = async () => {
    await resumeMutation.mutateAsync();
    dispatch({ type: 'CLOSE_RESUME_MODAL' });
  };

  // 파생 데이터 계산
  const subscriptionTier = subscription?.plan ?? 'free';
  const isProActive = subscription?.plan === 'pro' && subscription?.status === 'active';
  const isCanceled = subscription?.status === 'canceled';
  const isExpired = subscription?.status === 'expired';
  const canCancel = isProActive;
  const canResume = isCanceled && subscription?.nextBillingDate ?
    new Date(subscription.nextBillingDate) > new Date() : false;
  const daysUntilExpiry = subscription?.nextBillingDate ?
    differenceInDays(new Date(subscription.nextBillingDate), new Date()) : null;

  const value = useMemo(() => ({
    subscription,
    usageInfo,
    paymentHistories,
    isLoadingSubscription,
    isLoadingUsage,
    isLoadingHistories,

    state,
    dispatch,

    subscriptionTier,
    isProActive,
    isCanceled,
    isExpired,
    canCancel,
    canResume,
    daysUntilExpiry,

    handleSubscribe,
    handleCancel,
    handleResume,
    openCancelModal: () => dispatch({ type: 'OPEN_CANCEL_MODAL' }),
    closeCancelModal: () => dispatch({ type: 'CLOSE_CANCEL_MODAL' }),
    openResumeModal: () => dispatch({ type: 'OPEN_RESUME_MODAL' }),
    closeResumeModal: () => dispatch({ type: 'CLOSE_RESUME_MODAL' }),
    setCancelReason: (reason: string | null) =>
      dispatch({ type: 'SET_CANCEL_REASON', payload: { reason } }),
  }), [subscription, usageInfo, paymentHistories, state, /* ... */]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscriptionContext must be used within SubscriptionProvider');
  }
  return context;
}
```

---

### 4.2 페이지 컴포넌트

**파일**: `src/app/subscription/page.tsx`

```typescript
'use client';

import { SubscriptionProvider } from '@/features/subscription/context/subscription-context';
import { SubscriptionContent } from '@/features/subscription/components/subscription-content';

export default function SubscriptionPage() {
  return (
    <SubscriptionProvider>
      <SubscriptionContent />
    </SubscriptionProvider>
  );
}
```

---

### 4.3 메인 컨텐츠 (상태별 분기)

**파일**: `src/features/subscription/components/subscription-content.tsx`

```typescript
'use client';

import { useSubscriptionContext } from '../context/subscription-context';
import { FreeUserView } from './free-user-view';
import { ProActiveView } from './pro-active-view';
import { CanceledView } from './canceled-view';
import { ExpiredView } from './expired-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function SubscriptionContent() {
  const {
    subscriptionTier,
    isCanceled,
    isExpired,
    isLoadingSubscription,
  } = useSubscriptionContext();

  if (isLoadingSubscription) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (isExpired) {
    return <ExpiredView />;
  }

  if (subscriptionTier === 'free') {
    return <FreeUserView />;
  }

  if (isCanceled) {
    return <CanceledView />;
  }

  return <ProActiveView />;
}
```

---

### 4.4 주요 컴포넌트 구현 요약

각 컴포넌트는 `useSubscriptionContext()`를 통해 필요한 데이터 및 함수를 가져옵니다.

#### 4.4.1 FreeUserView

- 표시:
  - 현재 상태 카드 (무료 체험, 사용 X/1회)
  - Pro 요금제 안내 카드 (혜택, 가격)
  - SubscribeButton
- 사용: `usageInfo`, `handleSubscribe`

#### 4.4.2 ProActiveView

- 표시:
  - SubscriptionInfoCard (시작일, 다음 결제일)
  - UsageCard (X/10회, 다음 초기화 날짜)
  - PaymentMethodCard (카드사, 마지막 4자리)
  - PaymentHistoryList
  - CancelButton
- 사용: `subscription`, `usageInfo`, `paymentHistories`, `openCancelModal`

#### 4.4.3 CanceledView

- 표시:
  - SubscriptionInfoCard (혜택 만료일 강조)
  - UsageCard (만료 안내)
  - ResumeButton
- 사용: `subscription`, `usageInfo`, `daysUntilExpiry`, `openResumeModal`

#### 4.4.4 ExpiredView

- 표시:
  - 만료 안내 메시지
  - SubscribeButton (재구독)
- 사용: `handleSubscribe`

#### 4.4.5 모달 컴포넌트

- **CancelConfirmModal**:
  - 사용: `state.cancelModalOpen`, `closeCancelModal`, `handleCancel`, `setCancelReason`
  - 내용: 취소 사유 선택, 만료일까지 혜택 유지 안내

- **ResumeConfirmModal**:
  - 사용: `state.resumeModalOpen`, `closeResumeModal`, `handleResume`
  - 내용: 정기결제 재시작 안내, 다음 결제일 표시

- **PaymentSuccessModal**:
  - 사용: `state.paymentFlow === 'success'`
  - 내용: 축하 메시지, Pro 혜택 안내

- **PaymentErrorModal**:
  - 사용: `state.paymentFlow === 'error'`, `state.paymentError`
  - 내용: 에러 메시지, 재시도 버튼

---

## 5. 단계별 구현 순서

### Phase 1: 백엔드 기반 구축

1. **Zod 스키마 정의** (`schema.ts`)
   - 의존성: 없음
   - 완료 기준: 모든 타입 정의, 빌드 에러 없음

2. **에러 코드 정의** (`error.ts`)
   - 의존성: 없음
   - 완료 기준: 모든 에러 코드 상수 정의

3. **서비스 로직 구현** (`service.ts`)
   - 의존성: 공통 모듈 (토스페이먼츠 클라이언트, 사용량 관리)
   - 완료 기준: 모든 함수 구현, 트랜잭션 처리 확인

4. **Hono 라우터 구현** (`route.ts`)
   - 의존성: 서비스 로직, 인증 미들웨어
   - 완료 기준: 모든 엔드포인트 정의, 에러 핸들링 구현

5. **Webhook 핸들러 구현** (`webhook.ts`)
   - 의존성: 토스페이먼츠 클라이언트
   - 완료 기준: Webhook 서명 검증, 멱등성 보장

6. **Hono App에 라우터 등록** (`src/backend/hono/app.ts` 수정)
   - `registerSubscriptionRoutes(app)`
   - `registerWebhookRoutes(app)`

### Phase 2: 프론트엔드 기반 구축

7. **DTO 타입 재노출** (`lib/dto.ts`)
   - 의존성: 백엔드 스키마
   - 완료 기준: 프론트엔드에서 사용할 타입 export

8. **React Query 훅 구현** (`hooks/`)
   - 의존성: DTO 타입, API 클라이언트
   - 완료 기준: 모든 쿼리/뮤테이션 훅 구현

9. **Context 및 Reducer 구현** (`context/subscription-context.tsx`)
   - 의존성: React Query 훅, 토스페이먼츠 SDK 래퍼
   - 완료 기준: 모든 상태 및 액션 정의, 파생 데이터 계산

### Phase 3: UI 컴포넌트 구현

10. **공통 카드 컴포넌트** (병렬 구현 가능)
    - SubscriptionInfoCard
    - UsageCard
    - ProPlanCard
    - PaymentMethodCard
    - PaymentHistoryList
    - 의존성: Context, shadcn-ui 컴포넌트
    - 완료 기준: 각 컴포넌트 렌더링 확인

11. **버튼 컴포넌트** (병렬 구현 가능)
    - SubscribeButton
    - CancelButton
    - ResumeButton
    - 의존성: Context
    - 완료 기준: 클릭 이벤트 및 상태 변화 확인

12. **모달 컴포넌트** (병렬 구현 가능)
    - CancelConfirmModal
    - ResumeConfirmModal
    - PaymentSuccessModal
    - PaymentErrorModal
    - 의존성: Context, shadcn-ui Dialog
    - 완료 기준: 모달 열기/닫기 동작 확인

13. **뷰 컴포넌트** (병렬 구현 가능)
    - FreeUserView
    - ProActiveView
    - CanceledView
    - ExpiredView
    - 의존성: 카드/버튼/모달 컴포넌트
    - 완료 기준: 각 상태별 렌더링 확인

14. **메인 컨텐츠 컴포넌트** (`subscription-content.tsx`)
    - 의존성: 뷰 컴포넌트
    - 완료 기준: 상태별 분기 동작 확인

15. **페이지 컴포넌트** (`app/subscription/page.tsx`)
    - 의존성: Context, 메인 컨텐츠
    - 완료 기준: 페이지 접속 및 렌더링 확인

### Phase 4: 통합 및 테스트

16. **API 통합 테스트**
    - 각 엔드포인트 호출 확인
    - 에러 케이스 테스트

17. **결제 플로우 E2E 테스트**
    - 토스페이먼츠 테스트 환경에서 결제 시뮬레이션

18. **엣지케이스 테스트**
    - 동시 요청 방지
    - 만료된 구독 재개 시도
    - 빌링키 삭제 실패 처리

19. **UI/UX 검증**
    - 모달 흐름 확인
    - 로딩 상태 표시 확인
    - 반응형 디자인 확인

---

## 6. 필요한 shadcn-ui 컴포넌트

다음 컴포넌트가 필요하며, 설치되지 않은 경우 추가 설치:

```bash
npx shadcn@latest add card
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add badge
npx shadcn@latest add separator
npx shadcn@latest add skeleton
npx shadcn@latest add select
npx shadcn@latest add radio-group
```

---

## 7. 데이터베이스 의존성

다음 테이블이 마이그레이션되어 있어야 합니다:

- `users` (clerk_user_id, subscription_tier)
- `subscriptions` (plan, status, billing_key, customer_key, started_at, next_billing_date, canceled_at)
- `payment_histories` (payment_key, order_id, amount, status, paid_at)

---

## 8. 환경 변수 의존성

`.env.local` 파일에 다음 환경 변수 필요:

```bash
# 토스페이먼츠
TOSS_SECRET_KEY=
NEXT_PUBLIC_TOSS_CLIENT_KEY=
TOSS_WEBHOOK_SECRET=

# Clerk
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 9. 완료 기준

다음 조건이 모두 충족되면 구독 관리 페이지 개발 완료:

1. **기능 동작**:
   - [ ] 무료 유저가 Pro 구독 가능
   - [ ] Pro 유저가 구독 취소 가능
   - [ ] 취소 예정 유저가 구독 재개 가능
   - [ ] 결제 이력 조회 정상 동작

2. **엣지케이스 처리**:
   - [ ] 결제 실패 시 에러 모달 표시
   - [ ] 이미 취소된 구독 재취소 시도 방지
   - [ ] 만료된 구독 재개 시도 시 안내 메시지 표시

3. **UI/UX**:
   - [ ] 모든 모달 정상 동작 (열기/닫기)
   - [ ] 로딩 상태 표시
   - [ ] 반응형 디자인 적용
   - [ ] 접근성 요구사항 충족 (키보드 네비게이션, ARIA)

4. **보안**:
   - [ ] 인증 미들웨어 적용
   - [ ] Webhook 서명 검증
   - [ ] 본인 구독만 취소/재개 가능

5. **테스트**:
   - [ ] API 엔드포인트 모두 정상 응답
   - [ ] 토스페이먼츠 테스트 환경에서 결제 시뮬레이션 성공
   - [ ] 빌드 에러 없음 (`npm run build`)

---

## 10. 주의사항

### 10.1 DRY 원칙 준수

- **공통 모듈 재사용**: 토스페이먼츠 클라이언트, 사용량 관리 유틸리티는 이미 구현된 공통 모듈 사용
- **API 클라이언트 통합**: 모든 HTTP 요청은 `@/lib/remote/api-client` 경유
- **에러 핸들링 통일**: `failure` 헬퍼 및 표준 에러 코드 사용

### 10.2 타입 안전성

- **Zod 스키마 우선**: 모든 API 요청/응답은 Zod 스키마로 검증
- **타입 동기화**: 백엔드 스키마를 프론트엔드에서 재사용 (`lib/dto.ts`)
- **`any` 타입 금지**: 모든 타입 명시

### 10.3 보안

- **API 키 보호**: `TOSS_SECRET_KEY`는 절대 클라이언트 노출 금지
- **Webhook 검증**: 서명 검증 필수
- **인증 검증**: 모든 API는 `requireAuth()` 미들웨어 적용

### 10.4 성능

- **React Query 캐싱**: 구독 정보는 5분, 사용량은 1분 캐싱
- **컴포넌트 최적화**: `React.memo`, `useMemo`, `useCallback` 적절히 사용
- **번들 크기**: 토스페이먼츠 SDK는 Dynamic import 권장

### 10.5 사용자 경험

- **로딩 상태 표시**: 모든 비동기 작업에 로딩 인디케이터
- **명확한 에러 메시지**: 사용자 친화적인 에러 안내
- **확인 모달**: 중요 액션(취소/재개)은 확인 모달 필수

---

## 11. 참고 문서

- [PRD 섹션 3.2.6](/docs/prd.md)
- [Userflow 섹션 2, 5](/docs/userflow.md)
- [UC-002: Pro 구독 결제](/docs/usecases/2-pro-subscription/spec.md)
- [UC-005: 구독 관리](/docs/usecases/5-subscription-management/spec.md)
- [상태관리 설계](/docs/pages/5-subscription/state.md)
- [공통 모듈](/docs/common-modules.md)
- [Database 설계](/docs/database.md)

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-10-27 | Claude Code | 초기 구현 계획 작성 |
