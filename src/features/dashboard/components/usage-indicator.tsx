'use client';

import { formatRelativeDate } from '@/lib/utils/date';
import type { UsageInfoResponse } from '../lib/dto';

interface UsageIndicatorProps {
  usage: UsageInfoResponse;
}

export function UsageIndicator({ usage }: UsageIndicatorProps) {
  const { used, limit, remaining, nextResetDate } = usage;

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">
        남은 분석: <span className="text-lg font-bold">{remaining}/{limit}회</span>
      </p>
      {nextResetDate && (
        <p className="text-xs text-muted-foreground">
          다음 초기화: {formatRelativeDate(new Date(nextResetDate))}
        </p>
      )}
    </div>
  );
}
