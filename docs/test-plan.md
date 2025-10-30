## 최종 테스트 환경 구축 지침 (for AI Agent)

**TO:** AI 코딩 에이전트
**FROM:** Staff Engineer
**SUBJECT:** 프로젝트 테스트 환경 구축 실행

### **Mission Briefing**

당신의 임무는 주어진 코드베이스에 단위 테스트 및 E2E 테스트 환경을 구축하는 것입니다. 아래 지침을 정확히 따르십시오. 모든 결정은 '신속한 개발', '간결한 구조', '쉬운 온보딩'이라는 핵심 가치에 부합해야 합니다.

---

### **Phase 1: 의존성 설치**

`package.json`의 `devDependencies`에 아래 패키지들을 추가하고 설치를 실행하십시오.

```bash
npm install --save-dev jest @types/jest jest-environment-jsdom ts-jest @testing-library/react @testing-library/jest-dom playwright
```

---

### **Phase 2: 단위 테스트 환경 구축 (Jest)**

#### **2.1. Jest 설정 파일 생성**

1.  프로젝트 루트에 `jest.config.js` 파일을 생성하고 다음 내용을 입력하십시오. 이 설정은 Next.js 환경, TypeScript, 경로 별칭(`@/*`)을 처리합니다.

    ```javascript
    const nextJest = require('next/jest');

    const createJestConfig = nextJest({
      dir: './',
    });

    const customJestConfig = {
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      testEnvironment: 'jest-environment-jsdom',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/.next/',
        '<rootDir>/e2e/',
      ],
      transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
      },
    };

    module.exports = createJestConfig(customJestConfig);
    ```

2.  프로젝트 루트에 `jest.setup.js` 파일을 생성하고 다음 내용을 입력하십시오. 모든 테스트에서 `testing-library`의 matcher를 사용할 수 있게 합니다.

    ```javascript
    import '@testing-library/jest-dom';
    ```

#### **2.2. 첫 번째 단위 테스트 작성 (순수 함수)**

`src/lib/utils/date.ts` 파일에 대한 테스트를 위해, `src/lib/utils/date.test.ts` 파일을 생성하고 다음 코드를 추가하십시오.

```typescript
// src/lib/utils/date.test.ts
import { formatDate } from './date';

describe('formatDate', () => {
  it('기본 포맷(yyyy-MM-dd)으로 날짜를 올바르게 변환해야 한다', () => {
    const date = new Date('2025-10-29T10:00:00Z');
    expect(formatDate(date)).toBe('2025-10-29');
  });

  it('주어진 포맷 문자열에 따라 날짜를 올바르게 변환해야 한다', () => {
    const date = new Date('2025-10-29T10:00:00Z');
    const formatStr = 'yyyy년 MM월 dd일';
    expect(formatDate(date, formatStr)).toBe('2025년 10월 29일');
  });
});
```

#### **2.3. 외부 의존성 Mocking 전략 구현**

백엔드 서비스 로직 테스트를 위한 Mocking 예제를 구현합니다. `src/backend/services/usage.test.ts` 파일을 생성하고, `checkUsageLimit` 함수를 테스트하기 위해 Supabase Client를 모의(mock) 처리하는 다음 코드를 추가하십시오.

```typescript
// src/backend/services/usage.test.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { checkUsageLimit } from './usage';

// jest.mock을 사용하여 모듈 전체를 모의 객체로 대체
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
  }),
}));

describe('checkUsageLimit', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    // 각 테스트는 독립적이므로, 시작 전 모든 mock을 초기화
    jest.clearAllMocks();
    // 모의 Supabase 클라이언트 인스턴스 생성
    mockSupabase = new (jest.requireMock('@supabase/supabase-js').createClient)();
  });

  test('무료 사용자가 한 번도 사용하지 않았을 경우, 남은 횟수는 1이어야 한다', async () => {
    // 시나리오 1: users 테이블 조회 시 'free' 티어 반환
    (mockSupabase.from('users').select().eq().single as jest.Mock).mockResolvedValueOnce({
      data: { subscription_tier: 'free' },
      error: null,
    });

    // 시나리오 1: analyses 테이블 count 결과가 0으로 반환
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
    };
    (mockSupabase.from as jest.Mock).mockImplementation(tableName => {
      if (tableName === 'analyses') return mockQuery;
      return {
        // users 테이블용 mock
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: mockSupabase.from('users').select().eq().single as jest.Mock,
      };
    });

    const usage = await checkUsageLimit(mockSupabase as any, 'user-free-tier');

    expect(usage.subscriptionTier).toBe('free');
    expect(usage.limit).toBe(1);
    expect(usage.remaining).toBe(1);
  });
});
```

---

### **Phase 3: E2E 테스트 환경 구축 (Playwright)**

#### **3.1. Playwright 초기 설정 및 구성**

1.  프로젝트 루트에서 다음 명령어를 실행하여 Playwright를 초기화하십시오. (TypeScript, 기본 폴더 구조 선택)

    ```bash
    npx playwright init
    ```

2.  생성된 `playwright.config.ts` 파일을 열고, `webServer` 설정을 추가하여 테스트 실행 전 Next.js 개발 서버가 자동으로 시작되도록 구성하십시오.

    ```typescript
    // playwright.config.ts
    import { defineConfig, devices } from '@playwright/test';

    export default defineConfig({
      testDir: './e2e',
      fullyParallel: true,
      forbidOnly: !!process.env.CI,
      retries: process.env.CI ? 2 : 0,
      workers: process.env.CI ? 1 : undefined,
      reporter: 'html',
      use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
      },
      projects: [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ],
      // 테스트 실행 전 개발 서버를 시작하는 설정
      webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    });
    ```

#### **3.2. 첫 번째 E2E 테스트 작성 (인증)**

기본 예제 파일을 삭제하고, `e2e/auth.spec.ts` 파일을 생성하여 다음 코드를 추가하십시오. 이 테스트는 `.env` 파일에 정의된 테스트 계정 정보를 사용합니다.

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('인증 플로우', () => {
  test('사용자는 성공적으로 로그인하고 대시보드에 접근할 수 있어야 한다', async ({
    page,
  }) => {
    // 1. 로그인 페이지로 이동
    await page.goto('/sign-in');

    // 2. Clerk 폼이 로드될 때까지 대기
    await expect(page.locator('input[name="identifier"]')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('input[name="password"]')).toBeVisible();

    // 3. 테스트 계정 정보 입력 (반드시 .env.local 파일에 E2E_TEST_EMAIL, E2E_TEST_PASSWORD 설정)
    await page.locator('input[name="identifier"]').fill(process.env.E2E_TEST_EMAIL!);
    await page.locator('button[type="submit"]').click();
    await page.locator('input[name="password"]').fill(process.env.E2E_TEST_PASSWORD!);
    await page.locator('button[type="submit"]').click();

    // 4. 대시보드 페이지로 리디렉션되었는지 확인
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // 5. 대시보드의 특정 요소가 보이는지 확인하여 로그인 성공 검증
    await expect(page.getByRole('heading', { name: /안녕하세요/ })).toBeVisible();
  });
});
```

---

### **Phase 4: 최종 작업**

`package.json` 파일의 `scripts` 섹션에 다음 스크립트를 추가하여 테스트를 쉽게 실행할 수 있도록 하십시오.

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test:unit": "jest",
    "test:unit:watch": "jest --watch",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

### **Concluding Guidelines**

- **단위 테스트:** 순수 로직, 유틸리티 함수, 복잡한 비즈니스 로직(서비스)을 중심으로 작성하십시오. 모든 외부 의존성은 Mocking합니다.
- **컴포넌트 테스트:** `React Testing Library`를 사용하여 사용자의 상호작용을 시뮬레이션하고 렌더링 결과를 확인하는 테스트를 추가하십시오.
- **E2E 테스트:** 핵심 사용자 시나리오(회원가입, 분석 생성, 구독 결제)를 중심으로 작성하십시오.
- **CI 연동:** 향후 GitHub Actions 워크플로우를 설정하여 Pull Request 생성 시 모든 테스트가 자동으로 실행되도록 구성할 예정입니다.

이상입니다. 임무를 시작하십시오.
