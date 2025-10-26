'use client';

import { Button } from '@/components/ui/button';
import { useSubscriptionContext } from '../context/subscription-context';

export function CancelButton() {
  const { openCancelModal, canCancel } = useSubscriptionContext();

  if (!canCancel) {
    return null;
  }

  return (
    <Button variant="outline" onClick={openCancelModal} className="w-full">
      구독 취소
    </Button>
  );
}
