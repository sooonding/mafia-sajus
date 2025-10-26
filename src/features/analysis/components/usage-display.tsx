'use client';

import { useAnalysisNew } from '../context/analysis-new-context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils/date';

/**
 * 사용량 표시 컴포넌트
 */
export function UsageDisplay() {
  const { state, usageExceeded } = useAnalysisNew();

  if (state.isLoadingUsage) {
    return (
      <Card className="p-4">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </Card>
    );
  }

  if (!state.usageInfo) {
    return null;
  }

  const { used, limit, remaining, subscriptionTier, nextResetDate } = state.usageInfo;

  return (
    <Card className="p-4 border-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">
                남은 분석 횟수: {remaining}/{limit}회
              </span>
              <Badge variant={subscriptionTier === 'pro' ? 'default' : 'secondary'}>
                {subscriptionTier === 'pro' ? 'Pro' : '무료'}
              </Badge>
            </div>
            {nextResetDate && subscriptionTier === 'pro' && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Calendar className="w-3 h-3" />
                <span>다음 초기화: {formatDate(nextResetDate, 'yyyy-MM-dd')}</span>
              </div>
            )}
            {usageExceeded && (
              <p className="text-sm text-destructive mt-1">
                {subscriptionTier === 'free'
                  ? '무료 체험 1회를 모두 사용하였습니다'
                  : '이번 달 분석 횟수를 모두 사용하였습니다'}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
