'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/date';
import { APP_CONFIG } from '@/constants/app';
import type { Analysis } from '@/features/analysis/lib/dto';

interface AnalysisCardProps {
  analysis: Analysis;
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  const router = useRouter();

  const maskedBirthDate = analysis.birthDate.replace(/-\d{2}-\d{2}$/, '-**-**');
  const preview = analysis.result.personality.특성.slice(0, 100) + '...';

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {formatDate(new Date(analysis.createdAt), 'yyyy년 MM월 dd일 HH:mm')}
            </p>
            <p className="font-medium">{maskedBirthDate}</p>
          </div>
          <Badge variant={analysis.modelUsed === 'gemini-2.5-pro' ? 'default' : 'secondary'}>
            {analysis.modelUsed === 'gemini-2.5-pro' ? 'Pro' : 'Flash'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">{preview}</p>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push(APP_CONFIG.routes.analysisDetail(analysis.id))}
        >
          자세히 보기
        </Button>
      </CardFooter>
    </Card>
  );
}
