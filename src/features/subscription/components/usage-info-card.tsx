'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSubscriptionContext } from '../context/subscription-context';

export function UsageInfoCard() {
  const { usageInfo, subscriptionTier } = useSubscriptionContext();

  if (!usageInfo) {
    return null;
  }

  const usagePercentage = (usageInfo.used / usageInfo.limit) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>사용 현황</CardTitle>
        <CardDescription>이번 달 AI 분석 사용량</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">사용량</span>
            <span className="font-medium">
              {usageInfo.used} / {usageInfo.limit}회
            </span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
        </div>

        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">남은 횟수</span>
          <span className="text-sm font-medium">{usageInfo.remaining}회</span>
        </div>

        {subscriptionTier === 'pro' && usageInfo.nextResetDate && (
          <div className="mt-4 rounded-lg bg-muted p-3">
            <p className="text-sm text-muted-foreground">
              다음 초기화: {format(new Date(usageInfo.nextResetDate), 'PPP', { locale: ko })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
