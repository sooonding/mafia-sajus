/**
 * 애플리케이션 전역 상수
 */

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

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export const GENDER_LABELS = {
  male: '남성',
  female: '여성',
} as const;

export const CALENDAR_TYPE_LABELS = {
  solar: '양력',
  lunar: '음력',
} as const;
