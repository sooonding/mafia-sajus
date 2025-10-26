# 분석 상세보기 페이지 구현 계획

## 페이지 정보

- **경로**: `/analysis/[id]`
- **접근 권한**: 인증 필요 (본인 분석만 조회 가능)
- **목적**: 생성된 사주 분석 결과 전체 확인
- **관련 문서**:
  - PRD: 섹션 3.2.5 (분석 상세보기)
  - Userflow: 섹션 4.2 (특정 분석 상세 보기)
  - Usecase: UC-004 (분석 이력 조회)
  - State: `/docs/pages/4-analysis-detail/state.md`

---

## 1. 구현 개요

### 1.1 핵심 특징

- **읽기 전용 페이지**: 데이터 수정/삭제 없음
- **React Query 기반**: 서버 상태 관리 및 캐싱
- **권한 검증**: 백엔드에서 본인 분석만 조회 가능하도록 확인
- **에러 핸들링**: 403/404/네트워크 오류 각각 다른 UI 제공

### 1.2 구현 범위

**포함**:
- 분석 상세 데이터 조회 API
- 분석 상세보기 페이지 UI
- 에러 페이지 (403, 404, 네트워크 오류)
- React Query 기반 캐싱 및 재시도

**제외** (Phase 2):
- 분석 결과 PDF 저장
- 분석 결과 공유
- 섹션 접기/펼치기

---

## 2. 데이터베이스 (기존 스키마 활용)

### 2.1 사용할 테이블

이미 생성된 `analyses` 테이블을 활용합니다.

```sql
-- analyses 테이블 (이미 생성됨)
-- 참고: /supabase/migrations/0004_create_analyses_table.sql

SELECT
  id,
  user_id,
  birth_date,
  birth_time,
  is_lunar,
  gender,
  result,
  model_used,
  created_at
FROM analyses
WHERE id = $1 AND user_id = $2;
```

### 2.2 필요한 인덱스 (이미 생성됨)

- `idx_analyses_user_id_created_at` ON (user_id, created_at DESC)

---

## 3. Backend Layer

### 3.1 디렉토리 구조

```
src/features/analysis/
├── backend/
│   ├── route.ts        # Hono 라우터 (신규)
│   ├── service.ts      # Supabase 조회 로직 (신규)
│   ├── schema.ts       # Zod 스키마 (신규)
│   └── error.ts        # 에러 코드 (신규)
├── hooks/
│   └── use-analysis-detail.ts  # React Query 훅 (신규)
├── components/
│   ├── analysis-header.tsx     # 분석 정보 헤더 (신규)
│   ├── result-section.tsx      # 결과 섹션 컴포넌트 (신규)
│   ├── action-buttons.tsx      # 액션 버튼 (신규)
│   └── error-page.tsx          # 에러 페이지 (신규)
└── lib/
    └── dto.ts          # DTO 타입 재노출 (신규)
```

### 3.2 에러 코드 정의

**파일**: `src/features/analysis/backend/error.ts`

```typescript
export const analysisErrorCodes = {
  notFound: 'ANALYSIS_NOT_FOUND',
  forbidden: 'ANALYSIS_FORBIDDEN',
  dataCorrupted: 'ANALYSIS_DATA_CORRUPTED',
} as const;

export type AnalysisErrorCode = typeof analysisErrorCodes[keyof typeof analysisErrorCodes];

export type AnalysisServiceError = AnalysisErrorCode;
```

**사용 사례**:
- `ANALYSIS_NOT_FOUND` (404): 분석 ID가 존재하지 않음
- `ANALYSIS_FORBIDDEN` (403): 타인의 분석 조회 시도
- `ANALYSIS_DATA_CORRUPTED` (500): JSONB 파싱 실패

### 3.3 Zod 스키마

**파일**: `src/features/analysis/backend/schema.ts`

```typescript
import { z } from 'zod';

// 경로 파라미터 검증
export const AnalysisIdParamsSchema = z.object({
  id: z.string().uuid('유효하지 않은 분석 ID입니다'),
});

export type AnalysisIdParams = z.infer<typeof AnalysisIdParamsSchema>;

// 분석 결과 JSONB 구조
export const AnalysisResultSchema = z.object({
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
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// API 응답 스키마
export const AnalysisDetailResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  birthDate: z.string(),      // ISO 8601 date
  birthTime: z.string().nullable(),
  isLunar: z.boolean(),
  gender: z.enum(['male', 'female']),
  modelUsed: z.enum(['gemini-2.5-flash', 'gemini-2.5-pro']),
  result: AnalysisResultSchema,
  createdAt: z.string(),       // ISO 8601 datetime
});

export type AnalysisDetailResponse = z.infer<typeof AnalysisDetailResponseSchema>;
```

### 3.4 서비스 레이어

**파일**: `src/features/analysis/backend/service.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import { failure, success, type HandlerResult } from '@/backend/http/response';
import { analysisErrorCodes, type AnalysisServiceError } from './error';
import { AnalysisResultSchema, type AnalysisDetailResponse } from './schema';

export async function getAnalysisById(
  supabase: SupabaseClient,
  analysisId: string,
  userId: string,
): Promise<HandlerResult<AnalysisDetailResponse, AnalysisServiceError>> {
  // 1. 분석 조회
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .single();

  // 2. 데이터베이스 오류 처리
  if (error) {
    return failure(500, analysisErrorCodes.notFound, '분석을 찾을 수 없습니다');
  }

  // 3. 존재하지 않는 분석
  if (!data) {
    return failure(404, analysisErrorCodes.notFound, '분석을 찾을 수 없습니다');
  }

  // 4. 권한 확인 (본인 분석만 조회 가능)
  if (data.user_id !== userId) {
    return failure(403, analysisErrorCodes.forbidden, '본인의 분석 결과만 조회할 수 있습니다');
  }

  // 5. JSONB 파싱 검증
  const resultValidation = AnalysisResultSchema.safeParse(data.result);
  if (!resultValidation.success) {
    return failure(
      500,
      analysisErrorCodes.dataCorrupted,
      '분석 결과를 불러오는 중 오류가 발생했습니다',
      resultValidation.error.format(),
    );
  }

  // 6. DTO 변환 및 반환
  const response: AnalysisDetailResponse = {
    id: data.id,
    userId: data.user_id,
    birthDate: data.birth_date,
    birthTime: data.birth_time,
    isLunar: data.is_lunar,
    gender: data.gender,
    modelUsed: data.model_used,
    result: resultValidation.data,
    createdAt: data.created_at,
  };

  return success(response);
}
```

**핵심 로직**:
1. UUID 검증은 라우터에서 Zod로 처리
2. 데이터베이스 조회 (id 기준)
3. 데이터 존재 여부 확인 (404)
4. 소유권 확인 (user_id 비교, 403)
5. JSONB 파싱 검증 (500)
6. DTO 변환 및 반환

### 3.5 라우터

**파일**: `src/features/analysis/backend/route.ts`

```typescript
import type { Hono } from 'hono';
import { failure, respond } from '@/backend/http/response';
import { getLogger, getSupabase, type AppEnv } from '@/backend/hono/context';
import { requireAuth } from '@/backend/middleware/auth';
import { AnalysisIdParamsSchema } from './schema';
import { getAnalysisById } from './service';

export const registerAnalysisRoutes = (app: Hono<AppEnv>) => {
  // GET /api/analyses/:id - 분석 상세 조회
  app.get('/analyses/:id', requireAuth(), async (c) => {
    const logger = getLogger(c);
    const supabase = getSupabase(c);
    const userId = c.get('userId'); // requireAuth()에서 주입된 사용자 ID

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
          parsedParams.error.format(),
        ),
      );
    }

    // 2. 서비스 호출
    const result = await getAnalysisById(
      supabase,
      parsedParams.data.id,
      userId!,
    );

    // 3. 에러 로깅 (500번대 에러만)
    if (!result.ok && result.status >= 500) {
      logger.error('Failed to fetch analysis', {
        analysisId: parsedParams.data.id,
        userId,
        error: result.error,
      });
    }

    // 4. 응답 반환
    return respond(c, result);
  });
};
```

**핵심 포인트**:
- `requireAuth()` 미들웨어로 인증 확인 (공통 모듈)
- `userId`는 미들웨어에서 자동 주입
- 파라미터 검증 (UUID 형식)
- 서비스 레이어 호출
- 500번대 에러만 로깅 (4xx는 클라이언트 오류이므로 로깅 불필요)

### 3.6 Hono 앱에 라우터 등록

**파일**: `src/backend/hono/app.ts` (수정)

```typescript
// 기존 imports...
import { registerAnalysisRoutes } from '@/features/analysis/backend/route';

export function createHonoApp() {
  // ... 기존 코드 ...

  // 라우터 등록
  registerExampleRoutes(app);
  registerAnalysisRoutes(app); // 추가

  return app;
}
```

---

## 4. Frontend Layer

### 4.1 DTO 타입 재노출

**파일**: `src/features/analysis/lib/dto.ts`

```typescript
// backend/schema에서 정의한 타입을 프론트엔드에서 재사용
export type {
  AnalysisDetailResponse as AnalysisDetail,
  AnalysisResult,
} from '../backend/schema';
```

**목적**: 프론트엔드가 백엔드 타입을 직접 import하지 않고 lib/dto를 통해 사용

### 4.2 React Query 훅

**파일**: `src/features/analysis/hooks/use-analysis-detail.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { AnalysisDetail } from '../lib/dto';

export function useAnalysisDetail(analysisId: string) {
  return useQuery({
    queryKey: ['analysis', analysisId],
    queryFn: async () => {
      const response = await apiClient.get<AnalysisDetail>(
        `/analyses/${analysisId}`,
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000,      // 5분
    gcTime: 10 * 60 * 1000,         // 10분
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
}
```

**캐싱 전략**:
- `staleTime: 5분` - 한번 조회한 분석은 5분간 fresh 상태 유지
- `gcTime: 10분` - 메모리에서 제거되기까지 10분
- `refetchOnWindowFocus: false` - 포커스 복귀 시 재조회 안 함
- `retry: 3` - 네트워크 오류 시 최대 3회 재시도
- `retryDelay`: 지수 백오프 (1초, 2초, 3초)

### 4.3 에러 타입 판별 유틸

**파일**: `src/features/analysis/lib/error.ts`

```typescript
import { isAxiosError } from '@/lib/remote/api-client';

export type AnalysisErrorType = 'forbidden' | 'not-found' | 'network' | 'unknown';

export function getAnalysisErrorType(error: unknown): AnalysisErrorType {
  if (!error) return 'unknown';

  // Axios 에러인 경우
  if (isAxiosError(error)) {
    const code = (error.response?.data as any)?.error?.code;

    if (code === 'ANALYSIS_FORBIDDEN') {
      return 'forbidden';
    }

    if (code === 'ANALYSIS_NOT_FOUND') {
      return 'not-found';
    }

    // 네트워크 오류
    if (!error.response) {
      return 'network';
    }
  }

  // 일반 네트워크 에러
  if (error instanceof Error && error.message.includes('Network')) {
    return 'network';
  }

  return 'unknown';
}
```

### 4.4 컴포넌트: AnalysisHeader

**파일**: `src/features/analysis/components/analysis-header.tsx`

```typescript
'use client';

import { formatDate } from '@/lib/utils/date';
import { Badge } from '@/components/ui/badge';
import { GENDER_LABELS } from '@/constants/app';
import type { AnalysisDetail } from '../lib/dto';

interface AnalysisHeaderProps {
  analysis: AnalysisDetail;
}

export function AnalysisHeader({ analysis }: AnalysisHeaderProps) {
  const modelBadge =
    analysis.modelUsed === 'gemini-2.5-pro' ? (
      <Badge variant="default">Pro 모델</Badge>
    ) : (
      <Badge variant="secondary">Flash 모델</Badge>
    );

  const calendarType = analysis.isLunar ? '음력' : '양력';
  const genderLabel = GENDER_LABELS[analysis.gender];
  const birthTimeDisplay = analysis.birthTime ?? '모름';

  return (
    <div className="bg-card rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">사주 분석 결과</h1>
        {modelBadge}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">분석 날짜</span>
          <p className="font-medium">{formatDate(analysis.createdAt, 'yyyy년 MM월 dd일 HH:mm')}</p>
        </div>

        <div>
          <span className="text-muted-foreground">생년월일</span>
          <p className="font-medium">
            {formatDate(analysis.birthDate, 'yyyy년 MM월 dd일')} ({calendarType})
          </p>
        </div>

        <div>
          <span className="text-muted-foreground">출생 시간</span>
          <p className="font-medium">{birthTimeDisplay}</p>
        </div>

        <div>
          <span className="text-muted-foreground">성별</span>
          <p className="font-medium">{genderLabel}</p>
        </div>
      </div>
    </div>
  );
}
```

**사용할 shadcn-ui 컴포넌트**:
- `Badge`: 모델 배지 표시

### 4.5 컴포넌트: ResultSection

**파일**: `src/features/analysis/components/result-section.tsx`

```typescript
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ResultSectionProps {
  title: string;
  data: Record<string, string>;
}

export function ResultSection({ title, data }: ResultSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">
              {key}
            </h4>
            <p className="text-sm whitespace-pre-wrap">{value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

**사용할 shadcn-ui 컴포넌트**:
- `Card`, `CardHeader`, `CardTitle`, `CardContent`

### 4.6 컴포넌트: ActionButtons

**파일**: `src/features/analysis/components/action-buttons.tsx`

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface ActionButtonsProps {
  onBackToDashboard: () => void;
}

export function ActionButtons({ onBackToDashboard }: ActionButtonsProps) {
  return (
    <div className="flex justify-center mt-8">
      <Button onClick={onBackToDashboard} variant="outline" size="lg">
        <ArrowLeft className="mr-2 h-4 w-4" />
        대시보드로 돌아가기
      </Button>
    </div>
  );
}
```

**사용할 shadcn-ui 컴포넌트**:
- `Button`

**사용할 lucide-react 아이콘**:
- `ArrowLeft`

### 4.7 컴포넌트: ErrorPage

**파일**: `src/features/analysis/components/error-page.tsx`

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ErrorPageProps {
  title: string;
  message: string;
  action: {
    label: string;
    onClick: () => void;
  };
}

export function ErrorPage({ title, message, action }: ErrorPageProps) {
  return (
    <div className="container max-w-md mx-auto py-16 text-center">
      <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground mb-6">{message}</p>
      <Button onClick={action.onClick}>{action.label}</Button>
    </div>
  );
}
```

**사용할 shadcn-ui 컴포넌트**:
- `Button`

**사용할 lucide-react 아이콘**:
- `AlertCircle`

### 4.8 페이지 컴포넌트

**파일**: `src/app/(protected)/analysis/[id]/page.tsx`

```typescript
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAnalysisDetail } from '@/features/analysis/hooks/use-analysis-detail';
import { getAnalysisErrorType } from '@/features/analysis/lib/error';
import { AnalysisHeader } from '@/features/analysis/components/analysis-header';
import { ResultSection } from '@/features/analysis/components/result-section';
import { ActionButtons } from '@/features/analysis/components/action-buttons';
import { ErrorPage } from '@/features/analysis/components/error-page';
import { APP_CONFIG } from '@/constants/app';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AnalysisDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const { data, isLoading, isError, error, refetch } = useAnalysisDetail(id);

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">분석 결과를 불러오는 중...</p>
      </div>
    );
  }

  // 에러 상태
  if (isError) {
    const errorType = getAnalysisErrorType(error);

    switch (errorType) {
      case 'forbidden':
        return (
          <ErrorPage
            title="접근 권한 없음"
            message="본인의 분석 결과만 조회할 수 있습니다."
            action={{
              label: '대시보드로',
              onClick: () => router.push(APP_CONFIG.routes.dashboard),
            }}
          />
        );

      case 'not-found':
        return (
          <ErrorPage
            title="분석을 찾을 수 없습니다"
            message="요청하신 분석 결과가 존재하지 않습니다."
            action={{
              label: '대시보드로',
              onClick: () => router.push(APP_CONFIG.routes.dashboard),
            }}
          />
        );

      case 'network':
        return (
          <ErrorPage
            title="네트워크 오류"
            message="분석 결과를 불러오는 중 오류가 발생했습니다."
            action={{
              label: '다시 시도',
              onClick: () => refetch(),
            }}
          />
        );

      default:
        return (
          <ErrorPage
            title="오류 발생"
            message="분석 결과를 불러올 수 없습니다. 잠시 후 다시 시도해주세요."
            action={{
              label: '대시보드로',
              onClick: () => router.push(APP_CONFIG.routes.dashboard),
            }}
          />
        );
    }
  }

  // 정상 상태: 분석 결과 표시
  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8">
      <AnalysisHeader analysis={data} />

      <ResultSection title="사주팔자 기본 구성" data={data.result.basic} />
      <ResultSection title="성격 및 기질" data={data.result.personality} />
      <ResultSection
        title="대운·세운 분석"
        data={{
          대운: data.result.fortune.대운,
          세운: data.result.fortune.세운,
        }}
      />
      <ResultSection
        title="운세 종합"
        data={{
          직업운: data.result.fortune.직업운,
          재물운: data.result.fortune.재물운,
          건강운: data.result.fortune.건강운,
          연애운: data.result.fortune.연애운,
          대인관계운: data.result.fortune.대인관계운,
        }}
      />
      <ResultSection title="조언 및 제안" data={data.result.advice} />

      <ActionButtons
        onBackToDashboard={() => router.push(APP_CONFIG.routes.dashboard)}
      />
    </div>
  );
}
```

**핵심 구현 포인트**:
1. `use(params)` - Next.js 15의 Promise params 언팩
2. `useAnalysisDetail(id)` - React Query 훅으로 데이터 조회
3. 로딩 상태: 스피너 + 메시지
4. 에러 상태: 에러 타입별 분기 처리
5. 정상 상태: 섹션별 분석 결과 렌더링

---

## 5. 상수 추가

### 5.1 APP_CONFIG 확장

**파일**: `src/constants/app.ts` (수정)

```typescript
// 기존 코드...

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

## 6. 날짜 유틸리티 추가

### 6.1 formatDate 함수

**파일**: `src/lib/utils/date.ts` (신규)

```typescript
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

export const formatDate = (
  date: Date | string,
  formatStr = 'yyyy-MM-dd',
): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: ko });
};
```

**사용 예시**:
```typescript
formatDate('2025-10-27T14:30:00Z', 'yyyy년 MM월 dd일 HH:mm')
// "2025년 10월 27일 14:30"
```

---

## 7. 필요한 shadcn-ui 컴포넌트

다음 컴포넌트를 설치해야 합니다:

```bash
npx shadcn@latest add badge
npx shadcn@latest add card
```

**이미 설치된 컴포넌트**:
- `Button`

---

## 8. 구현 순서

### Phase 1: Backend (필수 선행)

1. **에러 코드 정의**
   - `src/features/analysis/backend/error.ts`
   - 의존성: 없음

2. **Zod 스키마**
   - `src/features/analysis/backend/schema.ts`
   - 의존성: 없음

3. **서비스 레이어**
   - `src/features/analysis/backend/service.ts`
   - 의존성: error.ts, schema.ts, response.ts

4. **라우터**
   - `src/features/analysis/backend/route.ts`
   - 의존성: service.ts, schema.ts, requireAuth middleware

5. **Hono 앱에 라우터 등록**
   - `src/backend/hono/app.ts` 수정
   - 의존성: route.ts

### Phase 2: Frontend (Backend 완료 후)

6. **shadcn-ui 컴포넌트 설치**
   - `npx shadcn@latest add badge card`

7. **DTO 타입 재노출**
   - `src/features/analysis/lib/dto.ts`
   - 의존성: backend/schema.ts

8. **날짜 유틸리티**
   - `src/lib/utils/date.ts`
   - 의존성: date-fns

9. **상수 추가**
   - `src/constants/app.ts` 수정
   - 의존성: 없음

10. **에러 타입 판별 유틸**
    - `src/features/analysis/lib/error.ts`
    - 의존성: api-client.ts

11. **React Query 훅**
    - `src/features/analysis/hooks/use-analysis-detail.ts`
    - 의존성: dto.ts, api-client.ts

### Phase 3: UI 컴포넌트 (병렬 가능)

12. **AnalysisHeader**
    - `src/features/analysis/components/analysis-header.tsx`
    - 의존성: dto.ts, date.ts, app.ts, badge

13. **ResultSection**
    - `src/features/analysis/components/result-section.tsx`
    - 의존성: card

14. **ActionButtons**
    - `src/features/analysis/components/action-buttons.tsx`
    - 의존성: button

15. **ErrorPage**
    - `src/features/analysis/components/error-page.tsx`
    - 의존성: button

### Phase 4: 페이지 통합

16. **페이지 컴포넌트**
    - `src/app/(protected)/analysis/[id]/page.tsx`
    - 의존성: 모든 컴포넌트 + 훅

---

## 9. 테스트 체크리스트

### 9.1 Backend 테스트

- [ ] **정상 시나리오**
  - [ ] 본인 분석 조회 시 200 응답 및 전체 데이터 반환
  - [ ] UUID 형식의 유효한 분석 ID로 조회

- [ ] **에러 시나리오**
  - [ ] 타인의 분석 ID로 조회 시 403 응답
  - [ ] 존재하지 않는 분석 ID로 조회 시 404 응답
  - [ ] 잘못된 UUID 형식으로 조회 시 400 응답
  - [ ] 인증되지 않은 사용자 조회 시 401 응답 (미들웨어)

- [ ] **데이터 검증**
  - [ ] JSONB result 필드가 스키마에 맞지 않을 경우 500 응답
  - [ ] 모든 필수 필드 포함 여부 확인

### 9.2 Frontend 테스트

- [ ] **정상 시나리오**
  - [ ] 본인 분석 조회 시 전체 결과 표시
  - [ ] 캐시된 분석 재조회 시 즉시 표시 (API 호출 없음)
  - [ ] "대시보드로 돌아가기" 버튼 클릭 시 라우팅

- [ ] **에러 시나리오**
  - [ ] 타인 분석 조회 시 403 에러 페이지 표시
  - [ ] 존재하지 않는 분석 조회 시 404 에러 페이지 표시
  - [ ] 네트워크 오류 시 "다시 시도" 버튼 표시 및 재시도 동작

- [ ] **UI 검증**
  - [ ] 로딩 상태 스피너 표시
  - [ ] 분석 헤더에 날짜, 생년월일, 모델 배지 표시
  - [ ] 각 섹션이 카드 형태로 렌더링
  - [ ] 모바일 반응형 확인

### 9.3 성능 테스트

- [ ] API 응답 시간 300ms 이내 (평균)
- [ ] React Query 캐싱 동작 확인
- [ ] 재시도 로직 동작 확인 (네트워크 오류 시)

### 9.4 보안 테스트

- [ ] 타인의 분석 조회 차단 (403)
- [ ] 인증되지 않은 요청 차단 (401)
- [ ] SQL Injection 방지 (Prepared Statement)

---

## 10. 에러 처리 전략

### 10.1 백엔드 에러 응답 형식

```json
{
  "error": {
    "code": "ANALYSIS_NOT_FOUND",
    "message": "분석을 찾을 수 없습니다"
  }
}
```

### 10.2 프론트엔드 에러 분류

| 에러 코드 | HTTP 상태 | 화면 표시 | 액션 |
|----------|----------|---------|------|
| ANALYSIS_FORBIDDEN | 403 | "접근 권한 없음" | 대시보드로 |
| ANALYSIS_NOT_FOUND | 404 | "분석 없음" | 대시보드로 |
| NETWORK_ERROR | - | "네트워크 오류" | 다시 시도 |
| UNKNOWN | 500 | "오류 발생" | 대시보드로 |

---

## 11. 공통 모듈 의존성

이 페이지는 다음 공통 모듈을 사용합니다:

### 11.1 Backend

- `requireAuth` 미들웨어 (`src/backend/middleware/auth.ts`)
- `success`, `failure`, `respond` (`src/backend/http/response.ts`)
- `getSupabase`, `getLogger` (`src/backend/hono/context.ts`)

### 11.2 Frontend

- `apiClient` (`src/lib/remote/api-client.ts`)
- `APP_CONFIG` (`src/constants/app.ts`)
- React Query 설정 (`src/app/providers.tsx`)

---

## 12. 페이지 간 충돌 방지

### 12.1 네이밍 규칙

- **라우터**: `registerAnalysisRoutes`
- **서비스**: `getAnalysisById`
- **에러 코드**: `analysisErrorCodes`
- **React Query 키**: `['analysis', analysisId]`

### 12.2 독립성 보장

- 이 페이지는 다른 페이지의 코드에 의존하지 않음
- 공통 모듈만 사용
- Feature 디렉토리 내에서 완결성 유지

---

## 13. 향후 확장 (Phase 2)

### 13.1 추가 기능 후보

- [ ] 분석 결과 PDF 저장 버튼
- [ ] 분석 결과 공유 모달
- [ ] 섹션 접기/펼치기 기능
- [ ] 분석 결과 인쇄 기능

### 13.2 확장 시 고려사항

- PDF 저장: 서버 사이드에서 HTML to PDF 변환 (라이브러리: puppeteer)
- 공유: 고유 공유 링크 생성 (일시적 토큰 기반)

---

## 14. 참고 사항

### 14.1 코드베이스 구조 준수

- **Backend**: Hono + Supabase 패턴 유지
- **Frontend**: Client Component + React Query
- **타입 안전성**: Zod 스키마 기반 검증
- **에러 처리**: 표준 에러 응답 형식 사용

### 14.2 DRY 원칙

- 날짜 포맷팅: `formatDate` 유틸 재사용
- 에러 응답: `failure` 헬퍼 재사용
- 권한 확인: `requireAuth` 미들웨어 재사용

### 14.3 YAGNI 원칙

- Phase 2 기능(PDF, 공유)은 현재 구현하지 않음
- Context + useReducer 대신 React Query만 사용 (충분함)

---

## 15. 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-10-27 | Claude Code | 초기 작성 |

---

## 16. 승인

- [ ] 백엔드 개발자
- [ ] 프론트엔드 개발자
- [ ] 테스트 담당자
