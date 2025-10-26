'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSubscriptionContext } from '../context/subscription-context';

export function ResumeModal() {
  const { state, closeResumeModal, handleResume, subscription } = useSubscriptionContext();

  if (!subscription?.nextBillingDate) {
    return null;
  }

  return (
    <Dialog open={state.resumeModalOpen} onOpenChange={closeResumeModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>구독을 재개하시겠습니까?</DialogTitle>
          <DialogDescription>
            구독을 재개하시면{' '}
            <strong>{format(new Date(subscription.nextBillingDate), 'PPP', { locale: ko })}</strong>
            부터 정기결제가 다시 시작됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground">
            재개 시 즉시 Pro 혜택을 계속 이용하실 수 있으며, 다음 결제일에 자동으로 결제됩니다.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeResumeModal}>
            취소
          </Button>
          <Button onClick={handleResume}>구독 재개</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
