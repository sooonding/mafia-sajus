'use client';

import { Card, CardContent } from '@/components/ui/card';
import { SubscriptionBadge } from './subscription-badge';
import { UsageIndicator } from './usage-indicator';
import type { CurrentUserResponse } from '@/features/auth/lib/dto';
import type { UsageInfoResponse } from '../lib/dto';

interface DashboardHeaderProps {
  user: CurrentUserResponse;
  usage: UsageInfoResponse;
}

export function DashboardHeader({ user, usage }: DashboardHeaderProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">안녕하세요, {user.email}님!</h1>
            <p className="text-muted-foreground">대시보드에 오신 것을 환영합니다.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <SubscriptionBadge
              tier={user.subscriptionTier}
              subscription={user.subscription}
            />
            <UsageIndicator usage={usage} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
