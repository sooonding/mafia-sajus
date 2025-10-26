'use client';

import { formatDate } from '@/lib/utils/date';
import { Badge } from '@/components/ui/badge';
import { GENDER_LABELS } from '@/constants/app';
import type { AnalysisDetail } from '../lib/dto';

interface AnalysisHeaderProps {
  analysis: AnalysisDetail;
}

export function AnalysisHeader({ analysis }: AnalysisHeaderProps) {
  const modelBadge =
    analysis.modelUsed === 'gemini-2.5-pro' ? (
      <Badge variant="default">Pro 모델</Badge>
    ) : (
      <Badge variant="secondary">Flash 모델</Badge>
    );

  const calendarType = analysis.isLunar ? '음력' : '양력';
  const genderLabel = GENDER_LABELS[analysis.gender];
  const birthTimeDisplay = analysis.birthTime ?? '모름';

  return (
    <div className="bg-card rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">사주 분석 결과</h1>
        {modelBadge}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">분석 날짜</span>
          <p className="font-medium">
            {formatDate(analysis.createdAt, 'yyyy년 MM월 dd일 HH:mm')}
          </p>
        </div>

        <div>
          <span className="text-muted-foreground">생년월일</span>
          <p className="font-medium">
            {formatDate(analysis.birthDate, 'yyyy년 MM월 dd일')} ({calendarType})
          </p>
        </div>

        <div>
          <span className="text-muted-foreground">출생 시간</span>
          <p className="font-medium">{birthTimeDisplay}</p>
        </div>

        <div>
          <span className="text-muted-foreground">성별</span>
          <p className="font-medium">{genderLabel}</p>
        </div>
      </div>
    </div>
  );
}
