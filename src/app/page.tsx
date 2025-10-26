'use client';

import { useUser } from '@clerk/nextjs';
import { Header } from '@/features/landing/components/header';
import { HeroSection } from '@/features/landing/components/hero-section';
import { FeaturesSection } from '@/features/landing/components/features-section';
import { PricingSection } from '@/features/landing/components/pricing-section';
import { CTASection } from '@/features/landing/components/cta-section';
import { Footer } from '@/features/landing/components/footer';

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser();

  // 로딩 중 처리
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isSignedIn={!!isSignedIn} />
      <main>
        <HeroSection isSignedIn={!!isSignedIn} />
        <FeaturesSection />
        <PricingSection />
        <CTASection isSignedIn={!!isSignedIn} />
      </main>
      <Footer />
    </div>
  );
}
