# 대시보드 페이지 구현 계획

## 개요

본 문서는 대시보드 페이지(`/dashboard`)의 구체적인 구현 계획을 정의합니다. PRD 섹션 3.2.3, Userflow, Database 설계, 유스케이스 UC-004, 상태관리 설계를 기반으로 작성되었습니다.

**페이지 경로**: `/dashboard`
**접근 권한**: 인증 필요
**주요 기능**: 사용자 현황 조회, 구독 상태 확인, 분석 이력 열람

---

## 1. 요구사항 분석

### 1.1 기능 요구사항 (PRD 기반)

**필수 기능**:
- 사용자 환영 메시지 표시
- 현재 구독 상태 배지 (무료/Pro/Pro 취소 예정)
- 남은 분석 횟수 표시 (X/Y회)
- Pro 업그레이드 버튼 (무료 유저만)
- 새 분석하기 버튼 (주요 CTA)
- 분석 이력 목록 (최신순, 페이지네이션)
- 구독 관리 페이지 링크

**제외 기능**:
- 분석 결과 수정/삭제
- 분석 결과 공유 (Phase 2)
- 분석 결과 PDF 저장 (Phase 2)

### 1.2 비기능 요구사항

**성능**:
- 초기 로딩 시간: 1.5초 이하
- 분석 이력 조회: 200ms 이하 (10개 항목)
- 페이지 전환 시 깜빡임 없음 (React Query 캐싱)

**UX**:
- 반응형 디자인 (모바일/태블릿/데스크톱)
- 로딩 시 스켈레톤 UI
- 명확한 에러 메시지 및 재시도 옵션

**보안**:
- 본인 분석만 조회 가능
- Clerk 세션 토큰 검증
- HTTPS 통신

---

## 2. 데이터 흐름 분석

### 2.1 서버 상태 (React Query)

| 데이터 | API 엔드포인트 | 캐싱 전략 | 무효화 시점 |
|--------|--------------|----------|-----------|
| 현재 사용자 정보 | `GET /api/me` | staleTime: 5분 | 구독 변경 시 |
| 사용량 정보 | `GET /api/me/usage` | staleTime: 1분 | 분석 완료 시, 구독 변경 시 |
| 분석 이력 | `GET /api/analyses?page={page}&limit={limit}` | staleTime: 5분 | 분석 완료 시 (page 1만) |

### 2.2 로컬 상태 (Context + useReducer)

| 상태 | 초기값 | 변경 조건 |
|------|-------|---------|
| `currentPage` | `1` | 페이지네이션 버튼 클릭 |
| `pageSize` | `10` | 설정 변경 (고정값으로 시작) |
| `isUpgradeModalOpen` | `false` | Pro 업그레이드 버튼 클릭 |

### 2.3 계산된 값 (Derived State)

- **사용 가능 여부**: `usageInfo.remaining > 0`
- **구독 상태 레이블**: `subscriptionTier` + `subscription.status` 조합
- **다음 초기화 날짜**: `formatRelativeDate(usageInfo.nextResetDate)`

---

## 3. 백엔드 API 설계

### 3.1 현재 사용자 조회 API

**엔드포인트**: `GET /api/me`

**구현 위치**: `src/features/auth/backend/route.ts` (신규)

**요청**:
```typescript
// 헤더: Authorization: Bearer {clerk_token}
// Body: 없음
```

**응답 스키마**:
```typescript
// src/features/auth/backend/schema.ts
import { z } from 'zod';

export const currentUserResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  subscriptionTier: z.enum(['free', 'pro']),
  subscription: z.object({
    status: z.enum(['active', 'canceled', 'expired']),
    nextBillingDate: z.string().datetime().optional(),
  }).optional(),
});

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
```

**비즈니스 로직** (`src/features/auth/backend/service.ts`):
```typescript
export async function getCurrentUser(
  supabase: SupabaseClient,
  userId: string
): Promise<CurrentUserResponse> {
  // 1. users 테이블에서 사용자 정보 조회
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, clerk_user_id, email, subscription_tier')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('USER_NOT_FOUND');
  }

  // 2. Pro 유저인 경우 구독 정보 조회
  let subscription = undefined;
  if (user.subscription_tier === 'pro') {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, next_billing_date')
      .eq('user_id', userId)
      .in('status', ['active', 'canceled'])
      .single();

    subscription = sub ? {
      status: sub.status,
      nextBillingDate: sub.next_billing_date,
    } : undefined;
  }

  return {
    id: user.id,
    clerkUserId: user.clerk_user_id,
    email: user.email,
    subscriptionTier: user.subscription_tier,
    subscription,
  };
}
```

**라우터 구현** (`src/features/auth/backend/route.ts`):
```typescript
import { Hono } from 'hono';
import { requireAuth } from '@/backend/middleware/auth';
import { success, failure } from '@/backend/http/response';
import { getCurrentUser } from './service';
import type { AppEnv } from '@/backend/hono/context';

export const authRouter = new Hono<AppEnv>();

authRouter.get('/me', requireAuth(), async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = c.get('supabase');

    const user = await getCurrentUser(supabase, userId);

    return success(c, user);
  } catch (error) {
    return failure(c, 500, 'INTERNAL_ERROR', '사용자 정보를 불러올 수 없습니다');
  }
});
```

**Hono 앱에 라우터 등록** (`src/backend/hono/app.ts`):
```typescript
import { authRouter } from '@/features/auth/backend/route';

export function createHonoApp() {
  const app = new Hono<AppEnv>();

  // ... 기존 미들웨어 ...

  // 라우터 등록
  app.route('/api', authRouter);

  return app;
}
```

---

### 3.2 사용량 조회 API

**엔드포인트**: `GET /api/me/usage`

**구현 위치**: `src/features/dashboard/backend/route.ts` (신규)

**응답 스키마**:
```typescript
// src/features/dashboard/backend/schema.ts
export const usageInfoResponseSchema = z.object({
  used: z.number().int().min(0),
  limit: z.number().int().min(1),
  remaining: z.number().int().min(0),
  nextResetDate: z.string().datetime().optional(),
});

export type UsageInfoResponse = z.infer<typeof usageInfoResponseSchema>;
```

**비즈니스 로직**:
- `src/backend/services/usage.ts`의 `checkUsageLimit` 함수 활용 (공통 모듈에서 이미 구현됨)

**라우터 구현**:
```typescript
import { Hono } from 'hono';
import { requireAuth } from '@/backend/middleware/auth';
import { success } from '@/backend/http/response';
import { checkUsageLimit } from '@/backend/services/usage';

export const dashboardRouter = new Hono<AppEnv>();

dashboardRouter.get('/me/usage', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const supabase = c.get('supabase');

  const usageInfo = await checkUsageLimit(supabase, userId);

  return success(c, usageInfo);
});
```

---

### 3.3 분석 이력 조회 API

**엔드포인트**: `GET /api/analyses?page={page}&limit={limit}`

**구현 위치**: `src/features/analysis/backend/route.ts` (신규)

**요청 파라미터**:
```typescript
const querySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(20)).default('10'),
});
```

**응답 스키마**:
```typescript
// src/features/analysis/backend/schema.ts
export const analysisSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  birthDate: z.string(), // ISO date
  birthTime: z.string().optional(), // HH:mm
  isLunar: z.boolean(),
  gender: z.enum(['male', 'female']),
  result: z.object({
    basic: z.object({
      천간지지: z.string(),
      오행분석: z.string(),
    }),
    personality: z.object({
      특성: z.string(),
      장단점: z.string(),
    }),
    fortune: z.object({
      대운: z.string(),
      세운: z.string(),
      직업운: z.string(),
      재물운: z.string(),
      건강운: z.string(),
      연애운: z.string(),
      대인관계운: z.string(),
    }),
    advice: z.object({
      긍정적방향: z.string(),
      주의점: z.string(),
    }),
  }),
  modelUsed: z.enum(['gemini-2.5-flash', 'gemini-2.5-pro']),
  createdAt: z.string().datetime(),
});

export const analysisHistoryResponseSchema = z.object({
  data: z.array(analysisSchema),
  total: z.number().int(),
  page: z.number().int(),
  totalPages: z.number().int(),
});

export type Analysis = z.infer<typeof analysisSchema>;
export type AnalysisHistoryResponse = z.infer<typeof analysisHistoryResponseSchema>;
```

**비즈니스 로직** (`src/features/analysis/backend/service.ts`):
```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnalysisHistoryResponse } from './schema';

export async function getAnalysisHistory(
  supabase: SupabaseClient,
  userId: string,
  page: number,
  limit: number
): Promise<AnalysisHistoryResponse> {
  const offset = (page - 1) * limit;

  // 1. 전체 개수 조회
  const { count, error: countError } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    throw new Error('FAILED_TO_COUNT_ANALYSES');
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  // 2. 페이지별 데이터 조회
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error('FAILED_TO_FETCH_ANALYSES');
  }

  // 3. 응답 포맷팅
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
```

**라우터 구현**:
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '@/backend/middleware/auth';
import { success, failure } from '@/backend/http/response';
import { getAnalysisHistory } from './service';

const querySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(20)).default('10'),
});

export const analysisRouter = new Hono<AppEnv>();

analysisRouter.get(
  '/analyses',
  requireAuth(),
  zValidator('query', querySchema),
  async (c) => {
    try {
      const userId = c.get('userId');
      const supabase = c.get('supabase');
      const { page, limit } = c.req.valid('query');

      const history = await getAnalysisHistory(supabase, userId, page, limit);

      return success(c, history);
    } catch (error) {
      return failure(c, 500, 'INTERNAL_ERROR', '분석 이력을 불러올 수 없습니다');
    }
  }
);
```

---

### 3.4 특정 분석 상세 조회 API

**엔드포인트**: `GET /api/analyses/:id`

**비즈니스 로직** (`src/features/analysis/backend/service.ts`):
```typescript
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

  // 소유권 확인
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
```

**라우터 구현**:
```typescript
analysisRouter.get('/analyses/:id', requireAuth(), async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const analysisId = c.req.param('id');

    const analysis = await getAnalysisById(supabase, userId, analysisId);

    return success(c, analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';

    if (message === 'ANALYSIS_NOT_FOUND') {
      return failure(c, 404, 'ANALYSIS_NOT_FOUND', '분석 결과를 찾을 수 없습니다');
    }

    if (message === 'ANALYSIS_FORBIDDEN') {
      return failure(c, 403, 'ANALYSIS_FORBIDDEN', '접근 권한이 없습니다');
    }

    return failure(c, 500, 'INTERNAL_ERROR', '분석 결과를 불러올 수 없습니다');
  }
});
```

---

## 4. 프론트엔드 구현

### 4.1 디렉토리 구조

```
src/features/dashboard/
├── components/
│   ├── dashboard-header.tsx           # 사용자 정보 + 구독 상태 + 사용량
│   ├── subscription-badge.tsx         # 구독 상태 배지
│   ├── usage-indicator.tsx            # 남은 분석 횟수 표시
│   ├── action-section.tsx             # 새 분석하기 + 업그레이드 버튼
│   ├── analysis-history-list.tsx      # 분석 이력 목록
│   ├── analysis-card.tsx              # 이력 카드 컴포넌트
│   ├── empty-state.tsx                # 이력 없음 상태
│   ├── pagination.tsx                 # 페이지네이션
│   └── upgrade-modal.tsx              # Pro 업그레이드 모달
├── context/
│   └── dashboard-context.tsx          # Context + Reducer
├── hooks/
│   ├── use-dashboard-data.ts          # React Query 훅
│   └── use-dashboard.ts               # Context 훅 (re-export)
├── types.ts                           # 타입 정의
└── lib/
    └── dto.ts                         # 백엔드 스키마 재노출

src/features/analysis/
├── backend/
│   ├── route.ts                       # 분석 조회 라우터
│   ├── service.ts                     # 분석 조회 비즈니스 로직
│   └── schema.ts                      # 분석 스키마
└── lib/
    └── dto.ts                         # 분석 타입 재노출

src/features/auth/
├── backend/
│   ├── route.ts                       # 사용자 조회 라우터 (신규)
│   ├── service.ts                     # 사용자 조회 로직 (신규)
│   └── schema.ts                      # 사용자 스키마 (신규)
└── lib/
    └── dto.ts                         # 사용자 타입 재노출
```

---

### 4.2 Context + Reducer 구현

**파일**: `src/features/dashboard/context/dashboard-context.tsx`

```typescript
'use client';

import { createContext, useContext, useReducer, ReactNode } from 'react';

// ----- 상태 타입 -----

interface DashboardState {
  currentPage: number;
  pageSize: number;
  isUpgradeModalOpen: boolean;
}

// ----- 액션 타입 -----

type DashboardAction =
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'OPEN_UPGRADE_MODAL' }
  | { type: 'CLOSE_UPGRADE_MODAL' }
  | { type: 'RESET_PAGINATION' };

// ----- Reducer -----

const initialState: DashboardState = {
  currentPage: 1,
  pageSize: 10,
  isUpgradeModalOpen: false,
};

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };

    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.payload, currentPage: 1 };

    case 'OPEN_UPGRADE_MODAL':
      return { ...state, isUpgradeModalOpen: true };

    case 'CLOSE_UPGRADE_MODAL':
      return { ...state, isUpgradeModalOpen: false };

    case 'RESET_PAGINATION':
      return { ...state, currentPage: 1 };

    default:
      return state;
  }
}

// ----- Context -----

interface DashboardContextValue {
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

// ----- Provider -----

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  return (
    <DashboardContext.Provider value={{ state, dispatch }}>
      {children}
    </DashboardContext.Provider>
  );
}

// ----- Hook -----

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
}
```

---

### 4.3 React Query 훅

**파일**: `src/features/dashboard/hooks/use-dashboard-data.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { CurrentUserResponse } from '@/features/auth/lib/dto';
import type { UsageInfoResponse, AnalysisHistoryResponse } from '@/features/dashboard/lib/dto';

// ----- 사용자 정보 -----

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await apiClient.get<CurrentUserResponse>('/api/me');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5분
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

// ----- 사용량 -----

export function useUsageInfo() {
  return useQuery({
    queryKey: ['usageInfo'],
    queryFn: async () => {
      const response = await apiClient.get<UsageInfoResponse>('/api/me/usage');
      return response.data;
    },
    staleTime: 1 * 60 * 1000, // 1분
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

// ----- 분석 이력 -----

export function useAnalysisHistory(page: number, limit: number) {
  return useQuery({
    queryKey: ['analyses', { page, limit }],
    queryFn: async () => {
      const response = await apiClient.get<AnalysisHistoryResponse>(
        `/api/analyses?page=${page}&limit=${limit}`
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5분
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });
}

// ----- 캐시 무효화 -----

export function useInvalidateDashboard() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries(['usageInfo']);
      queryClient.invalidateQueries(['analyses']);
    },
    invalidateUser: () => {
      queryClient.invalidateQueries(['currentUser']);
      queryClient.invalidateQueries(['usageInfo']);
    },
    invalidatePage: (page: number) => {
      queryClient.invalidateQueries(['analyses', { page }]);
    },
  };
}
```

---

### 4.4 주요 컴포넌트 구현

#### 4.4.1 대시보드 헤더

**파일**: `src/features/dashboard/components/dashboard-header.tsx`

```typescript
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { SubscriptionBadge } from './subscription-badge';
import { UsageIndicator } from './usage-indicator';
import type { CurrentUserResponse, UsageInfoResponse } from '../lib/dto';

interface DashboardHeaderProps {
  user: CurrentUserResponse;
  usage: UsageInfoResponse;
}

export function DashboardHeader({ user, usage }: DashboardHeaderProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* 환영 메시지 */}
          <div>
            <h1 className="text-2xl font-bold">안녕하세요, {user.email}님!</h1>
            <p className="text-muted-foreground">대시보드에 오신 것을 환영합니다.</p>
          </div>

          {/* 구독 상태 + 사용량 */}
          <div className="flex flex-col sm:flex-row gap-4">
            <SubscriptionBadge
              tier={user.subscriptionTier}
              subscription={user.subscription}
            />
            <UsageIndicator usage={usage} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 4.4.2 구독 상태 배지

**파일**: `src/features/dashboard/components/subscription-badge.tsx`

```typescript
'use client';

import { Badge } from '@/components/ui/badge';
import { match } from 'ts-pattern';

interface SubscriptionBadgeProps {
  tier: 'free' | 'pro';
  subscription?: {
    status: 'active' | 'canceled' | 'expired';
    nextBillingDate?: string;
  };
}

export function SubscriptionBadge({ tier, subscription }: SubscriptionBadgeProps) {
  const label = match({ tier, status: subscription?.status })
    .with({ tier: 'free' }, () => '무료 체험')
    .with({ tier: 'pro', status: 'active' }, () => 'Pro 구독 중')
    .with({ tier: 'pro', status: 'canceled' }, () => 'Pro (취소 예정)')
    .with({ tier: 'pro', status: 'expired' }, () => '구독 만료')
    .otherwise(() => '무료 체험');

  const variant = match({ tier, status: subscription?.status })
    .with({ tier: 'pro', status: 'active' }, () => 'default' as const)
    .with({ tier: 'pro', status: 'canceled' }, () => 'secondary' as const)
    .otherwise(() => 'outline' as const);

  return <Badge variant={variant}>{label}</Badge>;
}
```

#### 4.4.3 사용량 표시

**파일**: `src/features/dashboard/components/usage-indicator.tsx`

```typescript
'use client';

import { formatRelativeDate } from '@/lib/utils/date';
import type { UsageInfoResponse } from '../lib/dto';

interface UsageIndicatorProps {
  usage: UsageInfoResponse;
}

export function UsageIndicator({ usage }: UsageIndicatorProps) {
  const { used, limit, remaining, nextResetDate } = usage;

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">
        남은 분석: <span className="text-lg font-bold">{remaining}/{limit}회</span>
      </p>
      {nextResetDate && (
        <p className="text-xs text-muted-foreground">
          다음 초기화: {formatRelativeDate(new Date(nextResetDate))}
        </p>
      )}
    </div>
  );
}
```

#### 4.4.4 액션 섹션

**파일**: `src/features/dashboard/components/action-section.tsx`

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useDashboard } from '../context/dashboard-context';
import { APP_CONFIG } from '@/constants/app';
import type { CurrentUserResponse, UsageInfoResponse } from '../lib/dto';

interface ActionSectionProps {
  user: CurrentUserResponse;
  usage: UsageInfoResponse;
}

export function ActionSection({ user, usage }: ActionSectionProps) {
  const router = useRouter();
  const { dispatch } = useDashboard();

  const canAnalyze = usage.remaining > 0;
  const showUpgradeButton = user.subscriptionTier === 'free';

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* 새 분석하기 버튼 */}
      <Button
        size="lg"
        onClick={() => router.push(APP_CONFIG.routes.analysisNew)}
        disabled={!canAnalyze}
      >
        새 분석하기
      </Button>

      {/* Pro 업그레이드 버튼 (무료 유저만) */}
      {showUpgradeButton && (
        <Button
          size="lg"
          variant="outline"
          onClick={() => dispatch({ type: 'OPEN_UPGRADE_MODAL' })}
        >
          Pro로 업그레이드
        </Button>
      )}

      {/* 사용량 초과 안내 */}
      {!canAnalyze && (
        <p className="text-sm text-muted-foreground">
          {user.subscriptionTier === 'free'
            ? '무료 체험을 모두 사용하셨습니다. Pro로 업그레이드하여 더 많은 분석을 받아보세요.'
            : `이번 달 분석 횟수를 모두 사용하셨습니다. ${
                usage.nextResetDate
                  ? `다음 초기화: ${formatRelativeDate(new Date(usage.nextResetDate))}`
                  : ''
              }`}
        </p>
      )}
    </div>
  );
}
```

#### 4.4.5 분석 이력 목록

**파일**: `src/features/dashboard/components/analysis-history-list.tsx`

```typescript
'use client';

import { AnalysisCard } from './analysis-card';
import { EmptyState } from './empty-state';
import type { AnalysisHistoryResponse } from '../lib/dto';

interface AnalysisHistoryListProps {
  history: AnalysisHistoryResponse;
}

export function AnalysisHistoryList({ history }: AnalysisHistoryListProps) {
  if (history.data.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">분석 이력</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {history.data.map((analysis) => (
          <AnalysisCard key={analysis.id} analysis={analysis} />
        ))}
      </div>
    </div>
  );
}
```

#### 4.4.6 분석 카드

**파일**: `src/features/dashboard/components/analysis-card.tsx`

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/date';
import { APP_CONFIG } from '@/constants/app';
import type { Analysis } from '../lib/dto';

interface AnalysisCardProps {
  analysis: Analysis;
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  const router = useRouter();

  // 생년월일 마스킹
  const maskedBirthDate = analysis.birthDate.replace(/-\d{2}-\d{2}$/, '-**-**');

  // 미리보기 텍스트 (성격 특성 첫 100자)
  const preview = analysis.result.personality.특성.slice(0, 100) + '...';

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {formatDate(new Date(analysis.createdAt), 'yyyy년 MM월 dd일 HH:mm')}
            </p>
            <p className="font-medium">{maskedBirthDate}</p>
          </div>
          <Badge variant={analysis.modelUsed === 'gemini-2.5-pro' ? 'default' : 'secondary'}>
            {analysis.modelUsed === 'gemini-2.5-pro' ? 'Pro' : 'Flash'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">{preview}</p>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push(APP_CONFIG.routes.analysisDetail(analysis.id))}
        >
          자세히 보기
        </Button>
      </CardFooter>
    </Card>
  );
}
```

#### 4.4.7 빈 상태

**파일**: `src/features/dashboard/components/empty-state.tsx`

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/constants/app';

export function EmptyState() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">아직 분석 이력이 없습니다</h3>
        <p className="text-sm text-muted-foreground">
          첫 번째 사주 분석을 시작해보세요!
        </p>
      </div>
      <Button onClick={() => router.push(APP_CONFIG.routes.analysisNew)}>
        새 분석하기
      </Button>
    </div>
  );
}
```

#### 4.4.8 페이지네이션

**파일**: `src/features/dashboard/components/pagination.tsx`

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { useDashboard } from '../context/dashboard-context';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const { dispatch } = useDashboard();

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => dispatch({ type: 'SET_PAGE', payload: currentPage - 1 })}
      >
        이전
      </Button>

      <span className="text-sm">
        {currentPage} / {totalPages}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === totalPages}
        onClick={() => dispatch({ type: 'SET_PAGE', payload: currentPage + 1 })}
      >
        다음
      </Button>
    </div>
  );
}
```

---

### 4.5 페이지 컴포넌트

**파일**: `src/app/(protected)/dashboard/page.tsx`

```typescript
'use client';

import { DashboardProvider, useDashboard } from '@/features/dashboard/context/dashboard-context';
import {
  useCurrentUser,
  useUsageInfo,
  useAnalysisHistory,
} from '@/features/dashboard/hooks/use-dashboard-data';
import { DashboardHeader } from '@/features/dashboard/components/dashboard-header';
import { ActionSection } from '@/features/dashboard/components/action-section';
import { AnalysisHistoryList } from '@/features/dashboard/components/analysis-history-list';
import { Pagination } from '@/features/dashboard/components/pagination';
import { UpgradeModal } from '@/features/dashboard/components/upgrade-modal';
import { Separator } from '@/components/ui/separator';

function DashboardContent() {
  const { state } = useDashboard();
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const { data: usageInfo, isLoading: isLoadingUsage } = useUsageInfo();
  const { data: analysisHistory, isLoading: isLoadingHistory } = useAnalysisHistory(
    state.currentPage,
    state.pageSize
  );

  // 초기 로딩
  if (isLoadingUser || isLoadingUsage) {
    return <div>로딩 중...</div>; // TODO: 스켈레톤 UI
  }

  if (!currentUser || !usageInfo) {
    return <div>사용자 정보를 불러올 수 없습니다.</div>; // TODO: 에러 UI
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* 헤더 */}
      <DashboardHeader user={currentUser} usage={usageInfo} />

      {/* 액션 버튼 */}
      <ActionSection user={currentUser} usage={usageInfo} />

      <Separator />

      {/* 분석 이력 */}
      {isLoadingHistory ? (
        <div>이력 로딩 중...</div> // TODO: 스켈레톤 UI
      ) : analysisHistory ? (
        <>
          <AnalysisHistoryList history={analysisHistory} />
          <Pagination
            currentPage={state.currentPage}
            totalPages={analysisHistory.totalPages}
          />
        </>
      ) : (
        <div>이력을 불러올 수 없습니다.</div> // TODO: 에러 UI
      )}

      {/* Pro 업그레이드 모달 */}
      {state.isUpgradeModalOpen && <UpgradeModal />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
```

---

## 5. 에러 처리

### 5.1 백엔드 에러 코드

| 에러 코드 | HTTP 상태 | 상황 | 사용자 메시지 |
|----------|----------|------|-------------|
| `UNAUTHORIZED` | 401 | 인증 실패 | 로그인이 필요합니다 |
| `USER_NOT_FOUND` | 404 | 사용자 조회 실패 | 사용자 정보를 찾을 수 없습니다 |
| `ANALYSIS_NOT_FOUND` | 404 | 분석 조회 실패 | 분석 결과를 찾을 수 없습니다 |
| `ANALYSIS_FORBIDDEN` | 403 | 타인의 분석 접근 | 접근 권한이 없습니다 |
| `INTERNAL_ERROR` | 500 | 서버 오류 | 일시적인 오류가 발생했습니다 |

### 5.2 프론트엔드 에러 처리

**React Query 에러 핸들링**:
```typescript
const { data, error } = useCurrentUser();

if (error) {
  // 401: 로그인 페이지로 리다이렉트 (middleware에서 처리)
  // 기타: 에러 메시지 표시
}
```

**재시도 로직**:
- React Query 자동 재시도 (최대 3회)
- 사용자 수동 재시도 버튼 제공

---

## 6. 구현 순서

### Phase 1: 백엔드 API (선행 작업)
1. ✅ 공통 모듈 확인 (auth middleware, usage service 등)
2. **사용자 조회 API** (`src/features/auth/backend/*`)
   - schema.ts, service.ts, route.ts 구현
   - Hono 앱에 라우터 등록
3. **사용량 조회 API** (`src/features/dashboard/backend/*`)
   - schema.ts, route.ts 구현
   - 공통 usage service 활용
4. **분석 조회 API** (`src/features/analysis/backend/*`)
   - schema.ts, service.ts, route.ts 구현
   - 목록 조회 + 상세 조회

### Phase 2: 프론트엔드 기반
5. **타입 정의** (`src/features/dashboard/types.ts`, `lib/dto.ts`)
6. **Context 구현** (`context/dashboard-context.tsx`)
7. **React Query 훅** (`hooks/use-dashboard-data.ts`)

### Phase 3: 컴포넌트
8. **헤더 컴포넌트** (dashboard-header, subscription-badge, usage-indicator)
9. **액션 섹션** (action-section)
10. **이력 컴포넌트** (analysis-history-list, analysis-card, empty-state)
11. **페이지네이션** (pagination)
12. **모달** (upgrade-modal) - 결제 연동은 별도 페이지에서 처리

### Phase 4: 통합
13. **페이지 조립** (`app/(protected)/dashboard/page.tsx`)
14. **에러 바운더리 적용**
15. **로딩 스켈레톤 UI 구현**

### Phase 5: 최적화
16. **메모이제이션 적용** (memo)
17. **캐싱 전략 검증**
18. **테스트 시나리오 검증**

---

## 7. 테스트 계획

### 7.1 단위 테스트
- Reducer 로직 (각 액션별 상태 변경)
- 비즈니스 로직 (service.ts 함수들)
- 유틸리티 함수 (날짜 포맷팅 등)

### 7.2 통합 테스트
- API 엔드포인트 (요청/응답)
- React Query 캐싱 및 무효화
- Context + Reducer 통합

### 7.3 E2E 테스트 시나리오
1. 무료 유저 대시보드 진입 → 환영 메시지, 무료 배지, 1/1회 표시
2. 분석 이력 목록 조회 → 최신순 정렬, 페이지네이션
3. 특정 분석 카드 클릭 → 상세 페이지 이동
4. Pro 업그레이드 버튼 클릭 → 모달 표시
5. 페이지네이션 동작 확인

---

## 8. 의존성 및 선행 조건

### 8.1 백엔드 의존성
- ✅ `src/backend/middleware/auth.ts` (requireAuth)
- ✅ `src/backend/services/usage.ts` (checkUsageLimit)
- ✅ `src/backend/http/response.ts` (success, failure)
- ✅ `src/backend/hono/app.ts` (Hono 앱)
- ✅ `src/backend/supabase/helpers.ts` (트랜잭션 등)

### 8.2 프론트엔드 의존성
- ✅ `src/lib/remote/api-client.ts` (HTTP 클라이언트)
- ✅ `src/lib/query/config.ts` (React Query 설정)
- ✅ `src/lib/utils/date.ts` (날짜 유틸리티)
- ✅ `src/constants/app.ts` (라우트 상수)
- ✅ shadcn-ui 컴포넌트 (Card, Button, Badge 등)

### 8.3 데이터베이스
- ✅ `users` 테이블
- ✅ `subscriptions` 테이블
- ✅ `analyses` 테이블
- ✅ 인덱스: `idx_analyses_user_id_created_at`

---

## 9. 성능 최적화 전략

### 9.1 React Query 캐싱
- `currentUser`: 5분 staleTime, 구독 변경 시 무효화
- `usageInfo`: 1분 staleTime, 분석 완료 시 무효화
- `analyses`: 5분 staleTime, 페이지별 캐싱

### 9.2 컴포넌트 최적화
- `memo` 적용: AnalysisCard, Pagination
- `useMemo` 적용: 계산된 값 (사용 가능 여부 등)
- `useCallback` 적용: 이벤트 핸들러

### 9.3 데이터베이스 최적화
- 인덱스 활용: `(user_id, created_at DESC)`
- 페이지네이션: OFFSET/LIMIT
- COUNT 쿼리 최적화

---

## 10. 보안 고려사항

### 10.1 인증
- 모든 API는 `requireAuth()` 미들웨어 적용
- Clerk 세션 토큰 검증

### 10.2 권한
- 본인 분석만 조회 가능 (`user_id` 검증)
- URL 직접 입력으로 타인 분석 접근 차단

### 10.3 데이터 보호
- 생년월일 마스킹 (목록 뷰)
- HTTPS 통신
- SQL Injection 방지 (Supabase SDK)

---

## 11. 문서 검증

본 구현 계획은 다음 문서를 기반으로 작성되었습니다:

✅ **PRD**: 섹션 3.2.3 (대시보드 페이지)
✅ **Userflow**: 섹션 4 (분석 이력 조회 플로우)
✅ **Database**: 섹션 3 (테이블 스키마)
✅ **Usecase**: UC-004 (분석 이력 조회)
✅ **State Design**: `docs/pages/2-dashboard/state.md`
✅ **Common Modules**: `docs/common-modules.md`

**충돌 확인**:
- 기존 코드베이스의 디렉토리 구조 준수 ✅
- 공통 모듈 재사용 (auth, usage, api-client 등) ✅
- 타입 안전성 보장 (Zod 스키마) ✅
- DRY 원칙 준수 ✅

---

## 12. 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-10-27 | Claude | 초기 작성 |

---

**작성자**: Claude Code
**검토자**: -
**승인자**: -
