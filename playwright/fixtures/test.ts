import { test as base, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

const MOCK_USER_ID = '11111111-1111-1111-1111-111111111111';
const MOCK_ANALYSIS_ID = '22222222-2222-2222-2222-222222222222';

const mockCurrentUser = {
  id: MOCK_USER_ID,
  clerkUserId: 'clerk-user-123',
  email: 'zxcuiy@naver.com',
  subscriptionTier: 'free' as const,
};

const mockUsage = {
  used: 0,
  limit: 3,
  remaining: 3,
  nextResetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const mockAnalysis = {
  id: MOCK_ANALYSIS_ID,
  userId: MOCK_USER_ID,
  birthDate: '1990-01-01',
  birthTime: '08:30',
  isLunar: false,
  gender: 'male' as const,
  result: {
    basic: {
      천간지지: '갑자',
      오행분석: '목 화 토 금 수의 균형이 잘 맞습니다.',
    },
    personality: {
      특성: '분석적이며 책임감이 강한 성격입니다.',
      장단점: '장점은 성실함, 단점은 지나친 완벽주의입니다.',
    },
    fortune: {
      대운: '앞으로 10년은 성장의 시기입니다.',
      세운: '올해는 네트워크 확장이 중요합니다.',
      직업운: '협업이 활발한 직무에서 성과가 높습니다.',
      재물운: '투자보다 저축이 유리합니다.',
      건강운: '규칙적인 운동으로 체력 관리에 주의하세요.',
      연애운: '진솔한 대화가 관계를 발전시킵니다.',
      대인관계운: '주변 사람들의 도움을 받게 됩니다.',
    },
    advice: {
      긍정적방향: '새로운 시도를 두려워하지 마세요.',
      주의점: '과도한 걱정은 피하세요.',
    },
  },
  modelUsed: 'gemini-2.5-pro' as const,
  createdAt: new Date().toISOString(),
};

const mockAnalysisHistory = {
  data: [mockAnalysis],
  total: 1,
  page: 1,
  totalPages: 1,
};

const mockAnalysisUsage = {
  subscriptionTier: 'free' as const,
  used: 0,
  limit: 3,
  remaining: 3,
  nextResetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const mockSubscription = null;
const mockPaymentHistories: unknown[] = [];

const jsonHeaders = {
  'content-type': 'application/json',
};

const respondWithData = async (route: Route, data: unknown, status = 200) => {
  await route.fulfill({
    status,
    headers: jsonHeaders,
    body: JSON.stringify({ data }),
  });
};

const respondOk = async (route: Route) => {
  await respondWithData(route, { success: true });
};

async function setupMockApi(page: Parameters<typeof base.extend>[0]['page']) {
  await page.route('**/api/me', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return respondWithData(route, mockCurrentUser);
    }
    return respondWithData(route, null);
  });

  await page.route('**/api/me/usage', async (route) => {
    if (route.request().method() === 'GET') {
      return respondWithData(route, mockUsage);
    }
    return respondWithData(route, null);
  });

  await page.route('**/api/usage', async (route) => {
    if (route.request().method() === 'GET') {
      return respondWithData(route, mockUsage);
    }
    return respondWithData(route, null);
  });

  await page.route('**/api/payment-histories', async (route) => {
    if (route.request().method() === 'GET') {
      return respondWithData(route, mockPaymentHistories);
    }
    return respondOk(route);
  });

  await page.route('**/api/subscription', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return respondWithData(route, mockSubscription);
    }
    return respondOk(route);
  });

  await page.route('**/api/subscription/cancel', async (route) => {
    if (route.request().method() === 'POST') {
      return respondOk(route);
    }
    return route.continue();
  });

  await page.route('**/api/subscription/resume', async (route) => {
    if (route.request().method() === 'POST') {
      return respondOk(route);
    }
    return route.continue();
  });

  await page.route('**/api/analyses/usage', async (route) => {
    if (route.request().method() === 'GET') {
      return respondWithData(route, mockAnalysisUsage);
    }
    return respondWithData(route, mockAnalysisUsage);
  });

  await page.route('**/api/analyses', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'GET' && url.pathname === '/api/analyses') {
      return respondWithData(route, mockAnalysisHistory);
    }

    if (request.method() === 'POST' && url.pathname === '/api/analyses') {
      return respondWithData(route, mockAnalysis);
    }

    return route.continue();
  });

  await page.route(`**/api/analyses/${MOCK_ANALYSIS_ID}`, async (route) => {
    if (route.request().method() === 'GET') {
      return respondWithData(route, { analysis: mockAnalysis });
    }
    return route.continue();
  });
}

const test = base.extend({
  page: async ({ page }, use) => {
    await setupMockApi(page);
    await use(page);
  },
});

export { test, expect };
export { setupMockApi, mockAnalysis, MOCK_ANALYSIS_ID };
