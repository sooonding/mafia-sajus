'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscriptionContext } from '../context/subscription-context';

export function SubscribeButton() {
  const { handleSubscribe, state } = useSubscriptionContext();

  const isProcessing = state.paymentFlow === 'processing';

  return (
    <Button
      size="lg"
      onClick={handleSubscribe}
      disabled={isProcessing}
      className="w-full"
    >
      {isProcessing ? (
        <>처리 중...</>
      ) : (
        <>
          <Sparkles className="mr-2 h-5 w-5" />
          Pro 구독하기
        </>
      )}
    </Button>
  );
}
