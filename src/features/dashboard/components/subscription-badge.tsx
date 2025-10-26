'use client';

import { Badge } from '@/components/ui/badge';
import { match } from 'ts-pattern';

interface SubscriptionBadgeProps {
  tier: 'free' | 'pro';
  subscription?: {
    status?: 'active' | 'canceled' | 'expired';
    nextBillingDate?: string;
  };
}

export function SubscriptionBadge({ tier, subscription }: SubscriptionBadgeProps) {
  const label = match({ tier, status: subscription?.status })
    .with({ tier: 'free' }, () => '무료 체험')
    .with({ tier: 'pro', status: 'active' }, () => 'Pro 구독 중')
    .with({ tier: 'pro', status: 'canceled' }, () => 'Pro (취소 예정)')
    .with({ tier: 'pro', status: 'expired' }, () => '구독 만료')
    .otherwise(() => '무료 체험');

  const variant = match({ tier, status: subscription?.status })
    .with({ tier: 'pro', status: 'active' }, () => 'default' as const)
    .with({ tier: 'pro', status: 'canceled' }, () => 'secondary' as const)
    .otherwise(() => 'outline' as const);

  return <Badge variant={variant}>{label}</Badge>;
}
