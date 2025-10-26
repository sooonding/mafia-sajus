'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSubscriptionContext } from '../context/subscription-context';

export function SubscriptionInfoCard() {
  const { subscription, isCanceled, daysUntilExpiry } = useSubscriptionContext();

  if (!subscription) {
    return null;
  }

  const statusVariant = isCanceled ? 'destructive' : 'default';
  const statusLabel = isCanceled ? '취소 예정' : '활성';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>구독 정보</CardTitle>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
        <CardDescription>현재 구독 상태를 확인하세요</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {subscription.startedAt && (
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">시작일</span>
            <span className="text-sm font-medium">
              {format(new Date(subscription.startedAt), 'PPP', { locale: ko })}
            </span>
          </div>
        )}

        {subscription.nextBillingDate && (
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">
              {isCanceled ? '혜택 만료일' : '다음 결제일'}
            </span>
            <span className="text-sm font-medium">
              {format(new Date(subscription.nextBillingDate), 'PPP', { locale: ko })}
            </span>
          </div>
        )}

        {isCanceled && daysUntilExpiry !== null && (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              {daysUntilExpiry > 0
                ? `${daysUntilExpiry}일 후 Pro 혜택이 만료됩니다.`
                : '곧 Pro 혜택이 만료됩니다.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
