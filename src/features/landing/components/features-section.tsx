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
