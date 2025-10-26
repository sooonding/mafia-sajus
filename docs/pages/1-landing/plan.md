# 홈/랜딩 페이지 (/) 구현 계획

## 1. 개요

### 1.1 페이지 목적
- 서비스 소개 및 가치 제안 전달
- 신규 가입 유도 (주요 CTA: "무료로 시작하기")
- 인증 불필요 공개 페이지

### 1.2 참고 문서
- PRD 3.2.1: 홈 (랜딩페이지) `/`
- Userflow: 신규 회원가입 및 첫 분석 플로우
- State Design: `/docs/pages/1-landing/state.md`
- Common Modules: `/docs/common-modules.md`

### 1.3 기술 스택
- **Frontend**: Next.js 15 App Router, React 19, TypeScript
- **UI**: shadcn-ui, Tailwind CSS, Lucide React
- **인증**: Clerk SDK (`useAuth` 훅)
- **상태관리**: React useState (로컬 UI 상태), Clerk SDK (인증 상태)

---

## 2. 페이지 구성 요소

### 2.1 주요 섹션 (PRD 3.2.1 기준)

#### 2.1.1 히어로 섹션
**목적**: 첫 인상, 서비스 핵심 가치 전달

**구성 요소**:
- 메인 헤드라인: "AI가 풀어주는 당신의 사주팔자"
- 서브 헤드라인: "Google Gemini AI로 정확하고 체계적인 사주 분석을 경험하세요"
- 주요 CTA 버튼: "무료로 시작하기" (비로그인) / "대시보드로 가기" (로그인)
- 히어로 이미지 (선택사항, picsum.photos 플레이스홀더)

**동작**:
- 로그인 상태에 따라 CTA 버튼 텍스트 및 동작 분기
- 비로그인: `/sign-up` 페이지로 이동
- 로그인: `/dashboard` 페이지로 이동

#### 2.1.2 주요 특징 섹션 (Features)
**목적**: 서비스 차별화 포인트 강조

**구성 요소**: 3개 카드
1. **AI 기반 정확한 분석**
   - 아이콘: Sparkles (lucide-react)
   - 타이틀: "AI 기반 정확한 분석"
   - 설명: "Google Gemini 2.5 Pro 모델을 활용한 체계적이고 정밀한 사주 해석"

2. **합리적인 가격**
   - 아이콘: DollarSign
   - 타이틀: "합리적인 가격"
   - 설명: "월 3,900원으로 10회 고품질 분석 제공, 무료 체험 1회 포함"

3. **영구 보관**
   - 아이콘: Archive
   - 타이틀: "영구 보관"
   - 설명: "모든 분석 결과를 대시보드에서 언제든 다시 확인 가능"

**레이아웃**: `grid md:grid-cols-3 gap-6`

#### 2.1.3 가격 안내 섹션 (Pricing)
**목적**: 투명한 가격 정보 제공, Pro 전환 유도

**구성 요소**: 2개 카드 (무료, Pro)

**무료 체험 카드**:
- 타이틀: "무료 체험"
- 가격: "무료"
- 혜택 목록:
  - 1회 무료 분석
  - Gemini Flash 모델
  - 분석 결과 영구 보관

**Pro 카드** (강조 스타일):
- 타이틀: "Pro"
- 가격: "₩3,900/월"
- 혜택 목록:
  - 월 10회 분석
  - Gemini Pro 모델
  - 분석 결과 영구 보관
  - 우선 고객 지원
- 테두리 강조 (`border-primary`)

**레이아웃**: `grid md:grid-cols-2 gap-6`

#### 2.1.4 CTA 섹션
**목적**: 페이지 하단에서 재차 가입 유도

**구성 요소**:
- 헤드라인: "지금 바로 당신의 사주를 분석해보세요"
- CTA 버튼: "무료로 시작하기" (히어로와 동일한 동작)

---

## 3. 컴포넌트 설계

### 3.1 페이지 컴포넌트

#### `src/app/page.tsx` (기존 파일 대체)

**책임**:
- 페이지 최상위 컴포넌트
- Clerk SDK로 인증 상태 확인
- 하위 섹션 컴포넌트 조립

**구현**:
```typescript
'use client';

import { useAuth } from '@clerk/nextjs';
import { Header } from '@/features/landing/components/header';
import { HeroSection } from '@/features/landing/components/hero-section';
import { FeaturesSection } from '@/features/landing/components/features-section';
import { PricingSection } from '@/features/landing/components/pricing-section';
import { CTASection } from '@/features/landing/components/cta-section';
import { Footer } from '@/features/landing/components/footer';
import { LoadingSpinner } from '@/components/common/loading-spinner';

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isSignedIn={isSignedIn ?? false} />
      <main>
        <HeroSection isSignedIn={isSignedIn ?? false} />
        <FeaturesSection />
        <PricingSection />
        <CTASection isSignedIn={isSignedIn ?? false} />
      </main>
      <Footer />
    </div>
  );
}
```

**Props**: 없음 (페이지 컴포넌트)

**내부 상태**: 없음 (Clerk SDK 사용)

**사용 훅**:
- `useAuth()` (from @clerk/nextjs)

---

### 3.2 섹션 컴포넌트

#### 3.2.1 Header 컴포넌트

**위치**: `src/features/landing/components/header.tsx`

**책임**:
- 로고 표시
- 데스크톱 네비게이션 (로그인/회원가입 또는 대시보드/로그아웃)
- 모바일 햄버거 메뉴

**Props**:
```typescript
interface HeaderProps {
  isSignedIn: boolean;
}
```

**내부 상태**:
```typescript
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
```

**구현**:
```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { SignOutButton, UserButton } from '@clerk/nextjs';
import { APP_CONFIG } from '@/constants/app';
import { Button } from '@/components/ui/button';

export function Header({ isSignedIn }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* 로고 */}
        <Link href={APP_CONFIG.routes.home} className="text-xl font-bold">
          {APP_CONFIG.name}
        </Link>

        {/* 데스크톱 네비게이션 */}
        <nav className="hidden items-center gap-4 md:flex">
          {isSignedIn ? (
            <>
              <Link href={APP_CONFIG.routes.dashboard}>
                <Button variant="ghost">대시보드</Button>
              </Link>
              <UserButton afterSignOutUrl={APP_CONFIG.routes.home} />
            </>
          ) : (
            <>
              <Link href={APP_CONFIG.routes.signIn}>
                <Button variant="ghost">로그인</Button>
              </Link>
              <Link href={APP_CONFIG.routes.signUp}>
                <Button>회원가입</Button>
              </Link>
            </>
          )}
        </nav>

        {/* 모바일 햄버거 버튼 */}
        <button
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="모바일 메뉴 열기"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* 모바일 메뉴 오버레이 */}
      {isMobileMenuOpen && (
        <MobileMenu
          isSignedIn={isSignedIn}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      )}
    </header>
  );
}
```

**의존성**:
- `@clerk/nextjs` (UserButton)
- `@/constants/app` (APP_CONFIG)
- `@/components/ui/button` (shadcn-ui)

---

#### 3.2.2 HeroSection 컴포넌트

**위치**: `src/features/landing/components/hero-section.tsx`

**책임**:
- 메인 헤드라인 및 서브 헤드라인 표시
- 주요 CTA 버튼 (CTAButton 재사용)

**Props**:
```typescript
interface HeroSectionProps {
  isSignedIn: boolean;
}
```

**구현**:
```typescript
'use client';

import { LANDING_CONTENT } from '@/constants/landing';
import { CTAButton } from './cta-button';

export function HeroSection({ isSignedIn }: HeroSectionProps) {
  return (
    <section className="container mx-auto px-4 py-24 text-center">
      <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl">
        {LANDING_CONTENT.hero.title}
      </h1>
      <p className="mb-10 text-xl text-muted-foreground md:text-2xl">
        {LANDING_CONTENT.hero.subtitle}
      </p>
      <CTAButton isSignedIn={isSignedIn} variant="default" size="lg" />
    </section>
  );
}
```

**의존성**:
- `@/constants/landing` (LANDING_CONTENT)
- `./cta-button` (CTAButton)

---

#### 3.2.3 FeaturesSection 컴포넌트

**위치**: `src/features/landing/components/features-section.tsx`

**책임**:
- 주요 특징 3개 카드 표시
- 정적 데이터 사용 (LANDING_CONTENT.features)

**Props**: 없음 (정적 데이터 사용)

**구현**:
```typescript
'use client';

import * as LucideIcons from 'lucide-react';
import { LANDING_CONTENT } from '@/constants/landing';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function FeaturesSection() {
  return (
    <section className="container mx-auto px-4 py-16">
      <h2 className="mb-12 text-center text-3xl font-bold">주요 특징</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {LANDING_CONTENT.features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
}

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  const IconComponent = LucideIcons[icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>;

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <IconComponent className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
```

**의존성**:
- `@/constants/landing` (LANDING_CONTENT)
- `@/components/ui/card` (shadcn-ui)
- `lucide-react` (아이콘)

---

#### 3.2.4 PricingSection 컴포넌트

**위치**: `src/features/landing/components/pricing-section.tsx`

**책임**:
- 가격 안내 2개 카드 표시 (무료, Pro)
- 정적 데이터 사용 (LANDING_CONTENT.pricing)

**Props**: 없음

**구현**:
```typescript
'use client';

import { Check } from 'lucide-react';
import { LANDING_CONTENT } from '@/constants/landing';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PricingSection() {
  return (
    <section className="container mx-auto px-4 py-16">
      <h2 className="mb-12 text-center text-3xl font-bold">가격 안내</h2>
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        {LANDING_CONTENT.pricing.map((plan) => (
          <PricingCard key={plan.tier} {...plan} />
        ))}
      </div>
    </section>
  );
}

interface PricingCardProps {
  tier: 'free' | 'pro';
  name: string;
  price: number;
  features: string[];
}

function PricingCard({ tier, name, price, features }: PricingCardProps) {
  const isPro = tier === 'pro';

  return (
    <Card className={cn(isPro && 'border-primary shadow-lg')}>
      <CardHeader>
        <CardTitle className="text-2xl">{name}</CardTitle>
        <div className="mt-4 text-4xl font-bold">
          {price === 0 ? (
            '무료'
          ) : (
            <>
              ₩{price.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground">/월</span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 h-5 w-5 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

**의존성**:
- `@/constants/landing` (LANDING_CONTENT)
- `@/components/ui/card` (shadcn-ui)
- `@/lib/utils` (cn 유틸)

---

#### 3.2.5 CTASection 컴포넌트

**위치**: `src/features/landing/components/cta-section.tsx`

**책임**:
- 페이지 하단 CTA 섹션
- CTAButton 재사용

**Props**:
```typescript
interface CTASectionProps {
  isSignedIn: boolean;
}
```

**구현**:
```typescript
'use client';

import { CTAButton } from './cta-button';

export function CTASection({ isSignedIn }: CTASectionProps) {
  return (
    <section className="bg-primary/5 py-24">
      <div className="container mx-auto px-4 text-center">
        <h2 className="mb-6 text-4xl font-bold">
          지금 바로 당신의 사주를 분석해보세요
        </h2>
        <CTAButton isSignedIn={isSignedIn} variant="default" size="lg" />
      </div>
    </section>
  );
}
```

---

### 3.3 공통 컴포넌트

#### 3.3.1 CTAButton 컴포넌트

**위치**: `src/features/landing/components/cta-button.tsx`

**책임**:
- 로그인 상태에 따라 텍스트 및 동작 분기
- 재사용 가능한 CTA 버튼

**Props**:
```typescript
interface CTAButtonProps {
  isSignedIn: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}
```

**구현**:
```typescript
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/constants/app';
import { cn } from '@/lib/utils';

export function CTAButton({
  isSignedIn,
  variant = 'default',
  size = 'default',
  className,
}: CTAButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (isSignedIn) {
      router.push(APP_CONFIG.routes.dashboard);
    } else {
      router.push(APP_CONFIG.routes.signUp);
    }
  };

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={cn(className)}
    >
      {isSignedIn ? '대시보드로 가기' : '무료로 시작하기'}
    </Button>
  );
}
```

**의존성**:
- `next/navigation` (useRouter)
- `@/components/ui/button` (shadcn-ui)
- `@/constants/app` (APP_CONFIG)

---

#### 3.3.2 MobileMenu 컴포넌트

**위치**: `src/features/landing/components/mobile-menu.tsx`

**책임**:
- 모바일 화면 오버레이 메뉴
- 로그인/회원가입 또는 대시보드/로그아웃 링크

**Props**:
```typescript
interface MobileMenuProps {
  isSignedIn: boolean;
  onClose: () => void;
}
```

**구현**:
```typescript
'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { SignOutButton } from '@clerk/nextjs';
import { APP_CONFIG } from '@/constants/app';
import { Button } from '@/components/ui/button';

export function MobileMenu({ isSignedIn, onClose }: MobileMenuProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur md:hidden">
      <div className="container flex h-full flex-col px-4 py-6">
        {/* 닫기 버튼 */}
        <div className="flex justify-end">
          <button onClick={onClose} aria-label="메뉴 닫기">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 메뉴 링크 */}
        <nav className="mt-8 flex flex-col gap-4">
          {isSignedIn ? (
            <>
              <Link href={APP_CONFIG.routes.dashboard} onClick={onClose}>
                <Button variant="ghost" className="w-full justify-start">
                  대시보드
                </Button>
              </Link>
              <SignOutButton redirectUrl={APP_CONFIG.routes.home}>
                <Button variant="outline" className="w-full">
                  로그아웃
                </Button>
              </SignOutButton>
            </>
          ) : (
            <>
              <Link href={APP_CONFIG.routes.signIn} onClick={onClose}>
                <Button variant="ghost" className="w-full justify-start">
                  로그인
                </Button>
              </Link>
              <Link href={APP_CONFIG.routes.signUp} onClick={onClose}>
                <Button className="w-full">회원가입</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
```

**의존성**:
- `@clerk/nextjs` (SignOutButton)
- `@/constants/app` (APP_CONFIG)
- `@/components/ui/button` (shadcn-ui)

---

#### 3.3.3 Footer 컴포넌트

**위치**: `src/features/landing/components/footer.tsx`

**책임**:
- 푸터 정보 (저작권, 링크 등)

**Props**: 없음

**구현**:
```typescript
'use client';

import { APP_CONFIG } from '@/constants/app';

export function Footer() {
  return (
    <footer className="border-t bg-muted/40 py-8">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {APP_CONFIG.name}. All rights reserved.
      </div>
    </footer>
  );
}
```

---

#### 3.3.4 LoadingSpinner 컴포넌트

**위치**: `src/components/common/loading-spinner.tsx` (공통 모듈에서 이미 구현됨)

**사용**: Clerk SDK 로딩 중 표시

---

## 4. 상수 정의

### 4.1 랜딩 페이지 콘텐츠 상수

**위치**: `src/constants/landing.ts` (신규 생성)

**내용**:
```typescript
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
```

---

## 5. 스타일링 전략

### 5.1 레이아웃
- **Container**: `container mx-auto px-4`
- **섹션 패딩**: `py-16` 또는 `py-24`
- **반응형 그리드**: `grid md:grid-cols-2` 또는 `grid md:grid-cols-3`

### 5.2 타이포그래피
- **H1**: `text-5xl font-bold tracking-tight md:text-6xl`
- **H2**: `text-3xl font-bold`
- **Body**: `text-xl text-muted-foreground md:text-2xl`

### 5.3 카드 스타일
- shadcn-ui Card 컴포넌트 사용
- Pro 카드 강조: `border-primary shadow-lg`

### 5.4 색상
- Tailwind CSS 기본 색상 팔레트
- Primary 색상: 브랜드 색상 (보라색 계열 권장)
- Background: `bg-background`
- Muted: `text-muted-foreground`

---

## 6. 기능 요구사항 검증

### 6.1 PRD 3.2.1 요구사항 체크리스트

- [x] 히어로 섹션: "AI가 풀어주는 당신의 사주팔자"
- [x] 주요 특징 3개 카드 (AI 기반 분석, 합리적 가격, 영구 보관)
- [x] 가격 안내 (무료 1회, Pro 월 3,900원/10회)
- [x] CTA 버튼: "무료로 시작하기"
- [x] 인증 상태에 따른 CTA 분기

### 6.2 상태관리 설계 준수

- [x] Clerk SDK `useAuth()` 훅 사용
- [x] 로딩 상태 처리 (`isLoaded`)
- [x] 모바일 메뉴 상태 (`useState`)
- [x] Context 사용 안 함 (불필요)
- [x] React Query 사용 안 함 (API 호출 없음)

### 6.3 공통 모듈 활용

- [x] `APP_CONFIG` 사용 (routes)
- [x] shadcn-ui 컴포넌트 사용 (Button, Card)
- [x] Clerk SDK 컴포넌트 사용 (UserButton, SignOutButton)
- [x] `cn` 유틸 사용

---

## 7. 파일 구조

```
src/
├── app/
│   └── page.tsx                    # 랜딩 페이지 (기존 파일 대체)
├── features/
│   └── landing/
│       └── components/
│           ├── header.tsx          # 헤더 (로고, 네비게이션)
│           ├── hero-section.tsx    # 히어로 섹션
│           ├── features-section.tsx # 주요 특징 섹션
│           ├── pricing-section.tsx  # 가격 안내 섹션
│           ├── cta-section.tsx     # CTA 섹션
│           ├── cta-button.tsx      # 재사용 가능 CTA 버튼
│           ├── mobile-menu.tsx     # 모바일 메뉴 오버레이
│           └── footer.tsx          # 푸터
├── constants/
│   └── landing.ts                  # 랜딩 페이지 콘텐츠 상수 (신규)
└── components/
    └── common/
        └── loading-spinner.tsx     # 로딩 스피너 (공통 모듈)
```

---

## 8. 구현 순서

### Phase 1: 상수 및 공통 컴포넌트 (선행 작업)
1. `src/constants/landing.ts` 생성 (LANDING_CONTENT)
2. `src/features/landing/components/` 디렉터리 생성

### Phase 2: 재사용 컴포넌트
3. `cta-button.tsx` 구현
4. `mobile-menu.tsx` 구현
5. `footer.tsx` 구현

### Phase 3: 섹션 컴포넌트
6. `header.tsx` 구현
7. `hero-section.tsx` 구현
8. `features-section.tsx` 구현
9. `pricing-section.tsx` 구현
10. `cta-section.tsx` 구현

### Phase 4: 페이지 조립
11. `src/app/page.tsx` 구현 (기존 파일 대체)

### Phase 5: 검증
12. 반응형 테스트 (모바일, 태블릿, 데스크톱)
13. 인증 상태 테스트 (로그인/로그아웃)
14. CTA 버튼 동작 테스트
15. 접근성 검증 (키보드 네비게이션, 스크린 리더)

---

## 9. 의존성 확인

### 9.1 필수 패키지 (이미 설치됨)
- `@clerk/nextjs` - Clerk 인증
- `lucide-react` - 아이콘
- `tailwindcss` - 스타일링
- shadcn-ui 컴포넌트 (Button, Card)

### 9.2 추가 설치 필요 (없음)
모든 필요한 패키지는 공통 모듈에서 이미 설치됨

---

## 10. 에러 처리

### 10.1 Clerk SDK 로딩 실패
- `isLoaded=false` 상태일 때 LoadingSpinner 표시
- 타임아웃 없음 (Clerk SDK가 자동 처리)

### 10.2 네비게이션 실패
- router.push 에러 시 fallback 없음 (Next.js가 자동 처리)
- 필요 시 toast 메시지 추가 가능

---

## 11. 접근성 (Accessibility)

### 11.1 시맨틱 HTML
```tsx
<main>
  <section aria-labelledby="hero-title">
    <h1 id="hero-title">AI가 풀어주는 당신의 사주팔자</h1>
  </section>
  <section aria-labelledby="features-title">
    <h2 id="features-title">주요 특징</h2>
  </section>
  <section aria-labelledby="pricing-title">
    <h2 id="pricing-title">가격 안내</h2>
  </section>
</main>
```

### 11.2 ARIA 속성
- 모바일 메뉴 버튼: `aria-label="모바일 메뉴 열기"`
- 닫기 버튼: `aria-label="메뉴 닫기"`
- 아이콘: `aria-hidden="true"` (장식용)

### 11.3 키보드 네비게이션
- 모든 인터랙티브 요소는 `<button>` 또는 `<Link>` 사용
- Focus 스타일 기본 유지 (Tailwind CSS)
- Tab 순서 논리적 (위→아래, 좌→우)

---

## 12. 성능 최적화

### 12.1 이미지 최적화
- 히어로 이미지 사용 시 `next/image` 사용
- `priority` 속성 설정 (LCP 최적화)
- 플레이스홀더: picsum.photos

### 12.2 폰트 최적화
- `next/font/google` 사용 (이미 layout.tsx에 설정됨)

### 12.3 코드 스플리팅
- 현재 필요 없음 (페이지 단순)
- 향후 애니메이션 추가 시 `dynamic import` 고려

### 12.4 번들 최적화
- Lucide 아이콘: 필요한 아이콘만 import
- 트리 쉐이킹 자동 적용 (Next.js 기본)

---

## 13. 테스트 전략

### 13.1 수동 테스트 체크리스트

**인증 상태 테스트**:
- [ ] 비로그인 상태: "무료로 시작하기" 버튼 표시
- [ ] 비로그인 CTA 클릭 → `/sign-up` 이동
- [ ] 로그인 상태: "대시보드로 가기" 버튼 표시
- [ ] 로그인 CTA 클릭 → `/dashboard` 이동
- [ ] 헤더 네비게이션 분기 확인

**반응형 테스트**:
- [ ] 모바일 (320px): 햄버거 메뉴 표시
- [ ] 태블릿 (768px): 데스크톱 네비게이션 표시
- [ ] 데스크톱 (1024px+): 정상 레이아웃
- [ ] 그리드 레이아웃 반응형 확인

**UI 테스트**:
- [ ] 로딩 스피너 표시 (`isLoaded=false`)
- [ ] 모바일 메뉴 열기/닫기
- [ ] 카드 스타일 정상 표시
- [ ] Pro 카드 강조 표시 (테두리)

**접근성 테스트**:
- [ ] 키보드 네비게이션 (Tab)
- [ ] Focus 스타일 표시
- [ ] 스크린 리더 테스트 (NVDA/VoiceOver)

### 13.2 자동화 테스트 (선택사항, Phase 2 이후)
- Vitest + React Testing Library
- Playwright E2E 테스트

---

## 14. 기존 코드베이스 충돌 방지

### 14.1 기존 page.tsx 대체
- **현재**: SuperNext 템플릿 안내 페이지
- **변경**: 랜딩 페이지로 완전 대체
- **주의**: 기존 코드 백업 불필요 (git 히스토리에 남음)

### 14.2 재사용 가능 컴포넌트
- Header, Footer는 `src/features/landing/components/`에 배치
- 다른 페이지에서 재사용 필요 시 `src/components/common/`으로 이동 가능

### 14.3 상수 파일
- `src/constants/landing.ts` 신규 생성 (충돌 없음)
- `src/constants/app.ts` 이미 존재 (재사용)

---

## 15. 환경 설정 확인

### 15.1 Clerk 환경 변수
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### 15.2 Clerk 설정 (이미 완료됨)
- `src/app/layout.tsx`에 CurrentUserProvider 설정됨
- Middleware 설정 필요 (`middleware.ts`) - 공통 모듈에서 구현 예정

---

## 16. 완료 기준

다음 조건이 모두 충족되면 구현 완료:

1. **페이지 렌더링**
   - [ ] 랜딩 페이지 정상 표시
   - [ ] 모든 섹션 표시 (Hero, Features, Pricing, CTA)
   - [ ] 반응형 레이아웃 정상 동작

2. **인증 연동**
   - [ ] Clerk SDK 로딩 상태 처리
   - [ ] 로그인/로그아웃 상태 분기
   - [ ] CTA 버튼 동작 정상

3. **스타일링**
   - [ ] shadcn-ui 컴포넌트 정상 표시
   - [ ] 타이포그래피 일관성
   - [ ] 모바일 메뉴 정상 동작

4. **접근성**
   - [ ] 키보드 네비게이션 가능
   - [ ] ARIA 속성 설정
   - [ ] 시맨틱 HTML 사용

5. **성능**
   - [ ] Lighthouse 점수 90+ (Performance)
   - [ ] FCP < 1.5초

---

## 17. 향후 개선 사항 (Phase 2 이후)

### 17.1 애니메이션
- Framer Motion을 사용한 스크롤 애니메이션
- CTA 버튼 hover 효과 개선

### 17.2 SEO 최적화
- 메타 태그 최적화 (layout.tsx 수정)
- Open Graph 이미지 추가
- 구조화된 데이터 (JSON-LD)

### 17.3 A/B 테스트
- CTA 버튼 문구 변경 실험
- 가격 표시 방식 실험

---

## 18. 변경 이력

| 버전 | 날짜       | 작성자      | 변경 내용               |
| ---- | ---------- | ----------- | ----------------------- |
| 1.0  | 2025-10-27 | Claude Code | 초기 구현 계획 작성 완료 |

---

## 19. 참고 문서

- [PRD - 3.2.1 홈 페이지](/docs/prd.md#321-홈-랜딩페이지-)
- [Userflow - 신규 회원가입 플로우](/docs/userflow.md#1-신규-회원가입-및-첫-분석-플로우)
- [State Design - 랜딩 페이지](/docs/pages/1-landing/state.md)
- [Common Modules](/docs/common-modules.md)
- [Clerk Documentation](https://clerk.com/docs/references/react/use-auth)
- [shadcn-ui Documentation](https://ui.shadcn.com/)
