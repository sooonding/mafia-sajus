'use client';

import { CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubscriptionContext } from '../context/subscription-context';

export function PaymentMethodCard() {
  const { subscription } = useSubscriptionContext();

  if (!subscription?.billingKey) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>결제 수단</CardTitle>
        <CardDescription>등록된 카드 정보</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4">
          <div className="rounded-full bg-primary/10 p-3">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">등록된 카드</p>
            <p className="text-sm text-muted-foreground">자동 결제가 설정되어 있습니다</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
