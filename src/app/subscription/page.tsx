'use client';

import { SubscriptionProvider } from '@/features/subscription/context/subscription-context';
import { SubscriptionContent } from '@/features/subscription/components/subscription-content';

export default function SubscriptionPage() {
  return (
    <SubscriptionProvider>
      <SubscriptionContent />
    </SubscriptionProvider>
  );
}
