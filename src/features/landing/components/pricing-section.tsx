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
  features: readonly string[];
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
