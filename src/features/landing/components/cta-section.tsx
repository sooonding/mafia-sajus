'use client';

import { CTAButton } from './cta-button';

interface CTASectionProps {
  isSignedIn: boolean;
}

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
