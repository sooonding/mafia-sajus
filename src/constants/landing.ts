/**
 * 랜딩 페이지 콘텐츠 상수
 */

export const LANDING_CONTENT = {
  hero: {
    title: 'AI가 풀어주는 당신의 사주팔자',
    subtitle: 'Google Gemini AI로 정확하고 체계적인 사주 분석을 경험하세요',
  },
  features: [
    {
      icon: 'Sparkles',
      title: 'AI 기반 정확한 분석',
      description: 'Google Gemini 2.5 Pro 모델을 활용한 체계적이고 정밀한 사주 해석',
    },
    {
      icon: 'DollarSign',
      title: '합리적인 가격',
      description: '월 3,900원으로 10회 고품질 분석 제공, 무료 체험 1회 포함',
    },
    {
      icon: 'Archive',
      title: '영구 보관',
      description: '모든 분석 결과를 대시보드에서 언제든 다시 확인 가능',
    },
  ],
  pricing: [
    {
      tier: 'free' as const,
      name: '무료 체험',
      price: 0,
      features: [
        '1회 무료 분석',
        'Gemini Flash 모델',
        '분석 결과 영구 보관',
      ],
    },
    {
      tier: 'pro' as const,
      name: 'Pro',
      price: 3900,
      features: [
        '월 10회 분석',
        'Gemini Pro 모델',
        '분석 결과 영구 보관',
        '우선 고객 지원',
      ],
    },
  ],
} as const;
