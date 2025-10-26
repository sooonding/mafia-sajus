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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSubscriptionContext } from '../context/subscription-context';

const CANCEL_REASONS = [
  { value: 'expensive', label: '가격이 비싸요' },
  { value: 'not_useful', label: '서비스가 유용하지 않아요' },
  { value: 'alternative', label: '다른 서비스를 사용해요' },
  { value: 'temporary', label: '잠시 사용하지 않을 예정이에요' },
  { value: 'other', label: '기타' },
];

export function CancelModal() {
  const { state, closeCancelModal, handleCancel, setCancelReason, subscription } =
    useSubscriptionContext();

  if (!subscription?.nextBillingDate) {
    return null;
  }

  return (
    <Dialog open={state.cancelModalOpen} onOpenChange={closeCancelModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>구독을 취소하시겠습니까?</DialogTitle>
          <DialogDescription>
            구독을 취소하셔도{' '}
            <strong>{format(new Date(subscription.nextBillingDate), 'PPP', { locale: ko })}</strong>
            까지는 Pro 혜택을 계속 이용하실 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>취소 사유를 선택해주세요 (선택사항)</Label>
            <RadioGroup
              value={state.selectedReason ?? undefined}
              onValueChange={(value) => setCancelReason(value)}
              className="mt-2"
            >
              {CANCEL_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label htmlFor={reason.value} className="font-normal cursor-pointer">
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeCancelModal}>
            돌아가기
          </Button>
          <Button variant="destructive" onClick={handleCancel}>
            구독 취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
