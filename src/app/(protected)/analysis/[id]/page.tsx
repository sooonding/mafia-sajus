'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAnalysisDetail } from '@/features/analysis/hooks/use-analysis-detail';
import { getAnalysisErrorType } from '@/features/analysis/lib/error';
import { AnalysisHeader } from '@/features/analysis/components/analysis-header';
import { ResultSection } from '@/features/analysis/components/result-section';
import { ActionButtons } from '@/features/analysis/components/action-buttons';
import { ErrorPage } from '@/features/analysis/components/error-page';
import { APP_CONFIG } from '@/constants/app';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AnalysisDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const { data, isLoading, isError, error, refetch } = useAnalysisDetail(id);

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">분석 결과를 불러오는 중...</p>
      </div>
    );
  }

  // 에러 상태
  if (isError) {
    const errorType = getAnalysisErrorType(error);

    switch (errorType) {
      case 'forbidden':
        return (
          <ErrorPage
            title="접근 권한 없음"
            message="본인의 분석 결과만 조회할 수 있습니다."
            action={{
              label: '대시보드로',
              onClick: () => router.push(APP_CONFIG.routes.dashboard),
            }}
          />
        );

      case 'not-found':
        return (
          <ErrorPage
            title="분석을 찾을 수 없습니다"
            message="요청하신 분석 결과가 존재하지 않습니다."
            action={{
              label: '대시보드로',
              onClick: () => router.push(APP_CONFIG.routes.dashboard),
            }}
          />
        );

      case 'network':
        return (
          <ErrorPage
            title="네트워크 오류"
            message="분석 결과를 불러오는 중 오류가 발생했습니다."
            action={{
              label: '다시 시도',
              onClick: () => refetch(),
            }}
          />
        );

      default:
        return (
          <ErrorPage
            title="오류 발생"
            message="분석 결과를 불러올 수 없습니다. 잠시 후 다시 시도해주세요."
            action={{
              label: '대시보드로',
              onClick: () => router.push(APP_CONFIG.routes.dashboard),
            }}
          />
        );
    }
  }

  // 정상 상태: 분석 결과 표시
  if (!data) {
    return null;
  }

  const analysis = data.analysis;

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8">
      <AnalysisHeader analysis={analysis} />

      <ResultSection title="사주팔자 기본 구성" data={analysis.result.basic} />
      <ResultSection title="성격 및 기질" data={analysis.result.personality} />
      <ResultSection
        title="대운·세운 분석"
        data={{
          대운: analysis.result.fortune.대운,
          세운: analysis.result.fortune.세운,
        }}
      />
      <ResultSection
        title="운세 종합"
        data={{
          직업운: analysis.result.fortune.직업운,
          재물운: analysis.result.fortune.재물운,
          건강운: analysis.result.fortune.건강운,
          연애운: analysis.result.fortune.연애운,
          대인관계운: analysis.result.fortune.대인관계운,
        }}
      />
      <ResultSection title="조언 및 제안" data={analysis.result.advice} />

      <ActionButtons
        onBackToDashboard={() => router.push(APP_CONFIG.routes.dashboard)}
      />
    </div>
  );
}
