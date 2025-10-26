'use client';

import { Loader2 } from 'lucide-react';
import { useSubscriptionContext } from '../context/subscription-context';
import { FreeView } from './free-view';
import { ProActiveView } from './pro-active-view';
import { ProCanceledView } from './pro-canceled-view';
import { ExpiredView } from './expired-view';

export function SubscriptionContent() {
  const { subscriptionTier, isCanceled, isExpired, isLoadingSubscription } =
    useSubscriptionContext();

  if (isLoadingSubscription) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isExpired) {
    return <ExpiredView />;
  }

  if (subscriptionTier === 'free') {
    return <FreeView />;
  }

  if (isCanceled) {
    return <ProCanceledView />;
  }

  return <ProActiveView />;
}
