'use client';

import { LANDING_CONTENT } from '@/constants/landing';
import { CTAButton } from './cta-button';

interface HeroSectionProps {
  isSignedIn: boolean;
}

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
