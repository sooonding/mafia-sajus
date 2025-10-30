# TDD 테스트 작성 퀵스타트 프롬프트

> AI 코딩 어시스턴트에게 복사-붙여넣기하여 사용할 수 있는 프롬프트입니다.

---

## 🤖 AI에게 전달할 프롬프트

```
TDD 방식으로 다음 테스트를 작성해주세요.

## 가이드라인
- docs/rules/tdd.md의 TDD 원칙을 따르세요
- RED-GREEN-REFACTOR 사이클을 적용하세요
- AAA 패턴 (Arrange-Act-Assert)을 사용하세요
- 각 테스트는 독립적이어야 합니다
- beforeEach에서 jest.clearAllMocks() 호출하세요

## 작업 순서

### 1. 사용량 체크 로직 테스트 확장
파일: src/backend/services/usage.test.ts

기존 무료 유저 테스트에 다음 케이스 추가:
- Pro 사용자가 이번 달 5회 사용 (남은 횟수 5회)
- Pro 사용자가 이번 달 10회 사용 (남은 횟수 0회)
- 사용자를 찾을 수 없는 경우 에러
- Pro 사용자의 구독 정보를 찾을 수 없는 경우 에러

Supabase Mock 패턴:
- users 테이블: subscription_tier 반환
- subscriptions 테이블: started_at 반환
- analyses 테이블: count 반환

검증: npm run test:unit src/backend/services/usage.test.ts
기대: 6개 테스트 통과

---

### 2. Gemini API 클라이언트 테스트 작성
파일: src/backend/integrations/gemini/client.test.ts (신규)

GoogleGenerativeAI 모듈을 Mock하고 다음 케이스 테스트:
- API 호출 성공 (유효한 JSON 파싱)
- 마크다운 코드 블록(```json) 파싱
- 일반 코드 블록(```) 파싱
- 할당량 초과 (429) → 재시도 없이 즉시 실패
- 일시적 오류 (500) → 최대 3회 재시도
- 3회 재시도 후에도 실패 → EXTERNAL_API_ERROR
- 잘못된 JSON 형식 → 파싱 에러
- 필수 필드 누락 (basic, personality, fortune, advice) → 파싱 에러

Mock 응답 구조:
{
  basic: { 천간지지, 오행분석 },
  personality: { 특성, 장단점 },
  fortune: { 대운, 세운, 직업운, 재물운, 건강운, 연애운, 대인관계운 },
  advice: { 긍정적방향, 주의점 }
}

검증: npm run test:unit src/backend/integrations/gemini/client.test.ts
기대: 8개 테스트 통과

---

### 3. 토스페이먼츠 클라이언트 테스트 작성
파일: src/backend/integrations/tosspayments/client.test.ts (신규)

axios를 Mock하고 다음 함수들을 테스트:

**issueBillingKey**:
- 빌링키 발급 성공 → billingKey, customerKey 반환
- API 에러 → 'Billing key issuance failed' throw

**approveBilling**:
- 정기결제 승인 성공 → paymentKey, approvedAt(Date) 반환
- 결제 실패 → 'Billing approval failed' throw

**deleteBillingKey**:
- 빌링키 삭제 성공 → 에러 없이 완료
- 삭제 실패 → 'Billing key deletion failed' throw

**verifyWebhookSignature**:
- 올바른 서명 (HMAC SHA256) → true
- 잘못된 서명 → false
- 변조된 페이로드 → false
- 빈 페이로드 + 올바른 서명 → true

검증: npm run test:unit src/backend/integrations/tosspayments/client.test.ts
기대: 10개 테스트 통과

---

### 4. 전체 테스트 실행
npm run test:unit

기대 결과:
Test Suites: 4 passed, 4 total
Tests:       26 passed, 26 total

---

## 중요 패턴

### Supabase Mock
mockSupabase.from('테이블명').mockImplementation((tableName) => {
  if (tableName === 'users') return { select, eq, single: mockResolvedValue({ data, error }) };
  if (tableName === 'analyses') return { select, eq, gte, lt: mockResolvedValue({ count, error }) };
})

### Axios Mock
mockedAxios.post.mockResolvedValue({ data: {...} });
mockedAxios.post.mockRejectedValue({ isAxiosError: true, response: { data: { message } } });
mockedAxios.isAxiosError.mockReturnValue(true);

### Google AI Mock
jest.mock('@google/generative-ai');
(GoogleGenerativeAI as jest.MockedClass).mockImplementation(() => ({
  getGenerativeModel: () => ({ generateContent: mockGenerateContent })
}));

---

작업을 시작해주세요!
```

---

## 📝 사용 방법

1. 위 프롬프트 전체를 복사합니다
2. AI 코딩 어시스턴트에게 붙여넣습니다
3. AI가 순서대로 테스트를 작성하고 실행합니다
4. 각 단계마다 테스트 통과를 확인합니다

---

## 🎯 기대 결과

- ✅ 26개 테스트 모두 통과
- ✅ 약 15초 이내 실행 완료
- ✅ TDD 원칙 준수 (RED-GREEN-REFACTOR)
- ✅ 높은 코드 커버리지 (핵심 로직 90% 이상)
