'use client';

import { Badge } from '@/components/ui/badge';
import { SubscriptionInfoCard } from './subscription-info-card';
import { UsageInfoCard } from './usage-info-card';
import { ResumeButton } from './resume-button';
import { ResumeModal } from './resume-modal';

export function ProCanceledView() {
  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <h1 className="text-3xl font-bold">구독 관리</h1>
          <Badge variant="destructive">취소 예정</Badge>
        </div>
        <p className="text-muted-foreground">
          구독이 취소되었습니다. 만료일까지는 Pro 혜택을 계속 이용하실 수 있습니다.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SubscriptionInfoCard />
        <UsageInfoCard />
      </div>

      <ResumeButton />

      <ResumeModal />
    </div>
  );
}
