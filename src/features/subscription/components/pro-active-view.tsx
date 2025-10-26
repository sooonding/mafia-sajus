'use client';

import { Badge } from '@/components/ui/badge';
import { SubscriptionInfoCard } from './subscription-info-card';
import { UsageInfoCard } from './usage-info-card';
import { PaymentMethodCard } from './payment-method-card';
import { PaymentHistoryList } from './payment-history-list';
import { CancelButton } from './cancel-button';
import { CancelModal } from './cancel-modal';

export function ProActiveView() {
  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <h1 className="text-3xl font-bold">구독 관리</h1>
          <Badge>Pro 구독 중</Badge>
        </div>
        <p className="text-muted-foreground">
          Pro 구독을 이용 중입니다. 구독 정보와 사용 현황을 확인하세요.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SubscriptionInfoCard />
        <UsageInfoCard />
      </div>

      <PaymentMethodCard />

      <PaymentHistoryList />

      <CancelButton />

      <CancelModal />
    </div>
  );
}
