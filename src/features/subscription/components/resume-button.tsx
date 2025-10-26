'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscriptionContext } from '../context/subscription-context';

export function ResumeButton() {
  const { openResumeModal, canResume } = useSubscriptionContext();

  if (!canResume) {
    return null;
  }

  return (
    <Button onClick={openResumeModal} className="w-full">
      <RefreshCw className="mr-2 h-4 w-4" />
      구독 재개
    </Button>
  );
}
