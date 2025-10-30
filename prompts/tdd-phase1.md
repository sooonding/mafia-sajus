# TDD Phase 1: 핵심 기능 테스트 작성 가이드

> 이 프롬프트는 TDD 방식으로 핵심 외부 API 통합 및 비즈니스 로직에 대한 테스트를 작성하는 과정을 안내합니다.

## 📋 사전 준비

다음 파일들이 준비되어 있어야 합니다:
- ✅ `jest.config.js` - Jest 설정
- ✅ `jest.setup.js` - Testing Library 설정
- ✅ `docs/rules/tdd.md` - TDD 가이드라인
- ✅ 테스트 환경 구축 완료

## 🎯 목표

TDD Red-Green-Refactor 사이클을 따라 다음 테스트를 작성합니다:

1. **사용량 체크 로직** - Pro 유저 테스트 확장
2. **Gemini API 클라이언트** - 재시도 로직 및 에러 처리
3. **토스페이먼츠 클라이언트** - 빌링키, 결제 승인, Webhook 검증

---

## 📝 작업 순서

### 1️⃣ 사용량 체크 로직 테스트 확장

**파일**: `src/backend/services/usage.test.ts`

#### 작업 내용

기존 무료 유저 테스트에 Pro 유저 테스트 케이스 추가:

```typescript
// 추가할 테스트 케이스

test('Pro 사용자가 이번 달 5회 사용한 경우, 남은 횟수는 5회여야 한다', async () => {
  // Mock 설정:
  // - users 테이블: subscription_tier = 'pro'
  // - subscriptions 테이블: started_at 반환
  // - analyses 테이블: count = 5

  // 검증:
  // - subscriptionTier: 'pro'
  // - limit: 10
  // - used: 5
  // - remaining: 5
  // - nextResetDate: 정의됨
});

test('Pro 사용자가 이번 달 10회 모두 사용한 경우, 남은 횟수는 0이어야 한다', async () => {
  // count = 10으로 설정
  // remaining: 0
});

test('사용자를 찾을 수 없는 경우 에러를 throw해야 한다', async () => {
  // users 테이블 조회 시 error 반환
  // 'User not found' 에러 검증
});

test('Pro 사용자의 구독 정보를 찾을 수 없는 경우 에러를 throw해야 한다', async () => {
  // subscriptions 테이블 조회 시 error 반환
  // 'Subscription not found' 에러 검증
});
```

#### Supabase Mock 패턴

```typescript
(mockSupabase.from as jest.Mock).mockImplementation((tableName: string) => {
  if (tableName === 'users') {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { subscription_tier: 'pro' },
        error: null,
      }),
    };
  }
  if (tableName === 'subscriptions') {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { started_at: '2025-01-01T00:00:00Z' },
        error: null,
      }),
    };
  }
  if (tableName === 'analyses') {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockResolvedValue({
        count: 5,
        error: null,
      }),
    };
  }
  return mockSupabase;
});
```

#### 검증 명령어

```bash
npm run test:unit src/backend/services/usage.test.ts
```

**기대 결과**: 6개 테스트 통과

---

### 2️⃣ Gemini API 클라이언트 테스트 작성

**파일**: `src/backend/integrations/gemini/client.test.ts` (신규)

#### 작업 내용

Google Gemini AI API 클라이언트의 모든 기능 테스트:

```typescript
import { callGeminiAnalysis, type GeminiAnalysisRequest } from './client';
import { GoogleGenerativeAI } from '@google/generative-ai';

// GoogleGenerativeAI 모듈 Mock
jest.mock('@google/generative-ai');

describe('callGeminiAnalysis', () => {
  let mockGenerateContent: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent = jest.fn();

    (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>)
      .mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        }),
      }) as any);
  });

  // 테스트 케이스들...
});
```

#### 테스트 케이스 목록

1. **API 호출 성공**
   - Mock 응답: 유효한 JSON 객체
   - 검증: 파싱된 결과 반환

2. **마크다운 코드 블록 파싱**
   - Mock 응답: ` ```json\n{...}\n``` `
   - 검증: 올바르게 파싱

3. **할당량 초과 (429)**
   - Mock 에러: '429 Quota exceeded'
   - 검증: 즉시 실패 (재시도 없음)
   - `mockGenerateContent.toHaveBeenCalledTimes(1)`

4. **재시도 로직 (500)**
   - Mock: 2회 실패 후 3회 성공
   - 검증: 3회 호출 후 성공
   - `mockGenerateContent.toHaveBeenCalledTimes(3)`

5. **3회 재시도 후 실패**
   - Mock: 3회 모두 실패
   - 검증: 'EXTERNAL_API_ERROR' throw
   - `mockGenerateContent.toHaveBeenCalledTimes(3)`

6. **잘못된 JSON**
   - Mock 응답: 'This is not valid JSON'
   - 검증: 'Failed to parse' 에러

7. **필수 필드 누락**
   - Mock 응답: { basic: {...} } (나머지 누락)
   - 검증: 'Failed to parse' 에러

#### Mock 응답 예시

```typescript
const mockValidResponse = {
  basic: {
    천간지지: '경오 무인 갑진 을사',
    오행분석: '화 토가 강하고 금 수가 약함',
  },
  personality: {
    특성: '활발하고 외향적인 성격',
    장단점: '장점: 리더십, 단점: 급함',
  },
  fortune: {
    대운: '현재 대운 좋음',
    세운: '올해 세운 보통',
    직업운: '창업 적합',
    재물운: '재테크 시작 좋음',
    건강운: '건강 양호',
    연애운: '좋은 인연 만남',
    대인관계운: '사회생활 원만',
  },
  advice: {
    긍정적방향: '긍정적 마인드 유지',
    주의점: '급한 마음 주의',
  },
};

mockGenerateContent.mockResolvedValue({
  response: {
    text: () => JSON.stringify(mockValidResponse),
  },
});
```

#### 검증 명령어

```bash
npm run test:unit src/backend/integrations/gemini/client.test.ts
```

**기대 결과**: 8개 테스트 통과 (실행 시간: 약 12초)

---

### 3️⃣ 토스페이먼츠 클라이언트 테스트 작성

**파일**: `src/backend/integrations/tosspayments/client.test.ts` (신규)

#### 작업 내용

토스페이먼츠 API 통합의 모든 기능 테스트:

```typescript
import axios from 'axios';
import {
  issueBillingKey,
  approveBilling,
  deleteBillingKey,
  verifyWebhookSignature,
  TOSS_CONSTANTS,
} from './client';

// axios Mock
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('토스페이먼츠 클라이언트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 테스트 케이스들...
});
```

#### 테스트 케이스 목록

**A. issueBillingKey**

1. **빌링키 발급 성공**
   - Mock 응답: `{ billingKey, customerKey }`
   - 검증: 반환값 확인, API 호출 횟수 1회

2. **API 에러**
   - Mock: axios error (401, 403, 500)
   - 검증: 'Billing key issuance failed' 에러

**B. approveBilling**

3. **정기결제 승인 성공**
   - Mock 응답: `{ paymentKey, approvedAt }`
   - 검증: Date 객체로 변환 확인

4. **결제 실패**
   - Mock: 'Insufficient balance' 에러
   - 검증: 'Billing approval failed' 에러

**C. deleteBillingKey**

5. **빌링키 삭제 성공**
   - Mock: 성공 응답
   - 검증: 에러 없이 완료

6. **삭제 실패**
   - Mock: 'Billing key not found' 에러
   - 검증: 'Billing key deletion failed' 에러

**D. verifyWebhookSignature**

7. **올바른 서명**
   - HMAC SHA256으로 계산한 올바른 서명
   - 검증: `true` 반환

8. **잘못된 서명**
   - 임의의 잘못된 서명
   - 검증: `false` 반환

9. **변조된 페이로드**
   - 올바른 서명이지만 페이로드 변조
   - 검증: `false` 반환

10. **빈 페이로드**
    - 빈 문자열 + 올바른 서명
    - 검증: `true` 반환

#### Axios Mock 패턴

```typescript
// POST 성공
mockedAxios.post.mockResolvedValue({
  data: {
    billingKey: 'billing_key_1234',
    customerKey: 'user-uuid-1234',
  },
});

// POST 실패
mockedAxios.post.mockRejectedValue({
  isAxiosError: true,
  response: {
    data: {
      message: 'Invalid authKey',
    },
  },
});
mockedAxios.isAxiosError.mockReturnValue(true);
```

#### Webhook 서명 생성 예시

```typescript
const testPayload = JSON.stringify({
  eventType: 'PAYMENT_APPROVED',
  data: { paymentKey: 'xxx', amount: 3900 },
});

const crypto = require('crypto');
const hmac = crypto.createHmac('sha256', testWebhookSecret);
hmac.update(testPayload);
const validSignature = hmac.digest('hex');

const result = verifyWebhookSignature(testPayload, validSignature, testWebhookSecret);
expect(result).toBe(true);
```

#### 검증 명령어

```bash
npm run test:unit src/backend/integrations/tosspayments/client.test.ts
```

**기대 결과**: 10개 테스트 통과

---

## ✅ 전체 테스트 실행 및 검증

모든 테스트 작성 완료 후:

```bash
npm run test:unit
```

**기대 결과**:
```
Test Suites: 4 passed, 4 total
Tests:       26 passed, 26 total
Snapshots:   0 total
Time:        ~15s
```

**테스트 파일 목록**:
- ✅ `src/backend/services/usage.test.ts` (6 tests)
- ✅ `src/backend/integrations/gemini/client.test.ts` (8 tests)
- ✅ `src/backend/integrations/tosspayments/client.test.ts` (10 tests)
- ✅ `src/lib/utils/date.test.ts` (2 tests)

---

## 🎓 TDD 원칙 준수 확인

### RED-GREEN-REFACTOR 사이클

1. **RED**: 테스트 먼저 작성 → 실패 확인
2. **GREEN**: 최소 코드로 테스트 통과
3. **REFACTOR**: 코드 정리 및 개선

### FIRST 원칙

- ✅ **Fast**: 전체 테스트 15초 이내
- ✅ **Independent**: 각 테스트 독립 실행
- ✅ **Repeatable**: 언제든 동일한 결과
- ✅ **Self-validating**: 자동 Pass/Fail
- ✅ **Timely**: 코드 전 테스트 작성

### AAA 패턴

모든 테스트는 다음 구조를 따릅니다:

```typescript
test('설명', async () => {
  // Arrange (준비)
  const mockData = ...;
  mockFunction.mockResolvedValue(mockData);

  // Act (실행)
  const result = await functionUnderTest(...);

  // Assert (검증)
  expect(result).toEqual(...);
  expect(mockFunction).toHaveBeenCalledTimes(1);
});
```

---

## 🚨 주의사항

1. **Mock 초기화**: 각 테스트 전 `jest.clearAllMocks()` 필수
2. **비동기 처리**: `async/await` 사용
3. **에러 테스트**: `expect(...).rejects.toThrow()` 사용
4. **독립성**: 테스트 간 상태 공유 금지
5. **명확한 이름**: 테스트 설명은 한글로 명확하게

---

## 📚 참고 자료

- Jest 공식 문서: https://jestjs.io/
- Testing Library: https://testing-library.com/
- TDD 가이드라인: `docs/rules/tdd.md`

---

## 🎯 다음 단계

Phase 1 완료 후:

1. **Phase 2**: 비즈니스 로직 테스트 작성
   - `analysis/backend/service.test.ts`
   - `subscription/backend/service.test.ts`

2. **E2E 테스트 확장**
   - 사주 분석 플로우
   - 구독 결제 플로우

3. **테스트 커버리지**
   - Jest coverage 리포트 생성
   - 커버리지 목표: 80% 이상
