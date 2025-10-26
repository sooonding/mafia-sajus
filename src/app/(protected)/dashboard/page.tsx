'use client';

import { DashboardProvider, useDashboard } from '@/features/dashboard/context/dashboard-context';
import {
  useCurrentUser,
  useUsageInfo,
  useAnalysisHistory,
} from '@/features/dashboard/hooks/use-dashboard-data';
import { DashboardHeader } from '@/features/dashboard/components/dashboard-header';
import { AnalysisCard } from '@/features/dashboard/components/analysis-card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { APP_CONFIG } from '@/constants/app';

function DashboardContent() {
  const router = useRouter();
  const { state } = useDashboard();
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const { data: usageInfo, isLoading: isLoadingUsage } = useUsageInfo();
  const { data: analysisHistory, isLoading: isLoadingHistory } = useAnalysisHistory(
    state.currentPage,
    state.pageSize
  );

  if (isLoadingUser || isLoadingUsage) {
    return <div className="container mx-auto py-8">로딩 중...</div>;
  }

  if (!currentUser || !usageInfo) {
    return <div className="container mx-auto py-8">사용자 정보를 불러올 수 없습니다.</div>;
  }

  const canAnalyze = usageInfo.remaining > 0;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <DashboardHeader user={currentUser} usage={usageInfo} />

      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          size="lg"
          onClick={() => router.push(APP_CONFIG.routes.analysisNew)}
          disabled={!canAnalyze}
        >
          새 분석하기
        </Button>

        {currentUser.subscriptionTier === 'free' && (
          <Button
            size="lg"
            variant="outline"
            onClick={() => router.push(APP_CONFIG.routes.subscription)}
          >
            Pro로 업그레이드
          </Button>
        )}
      </div>

      {!canAnalyze && (
        <p className="text-sm text-muted-foreground">
          {currentUser.subscriptionTier === 'free'
            ? '무료 체험을 모두 사용하셨습니다. Pro로 업그레이드하여 더 많은 분석을 받아보세요.'
            : '이번 달 분석 횟수를 모두 사용하셨습니다.'}
        </p>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-bold">분석 이력</h2>

        {isLoadingHistory ? (
          <div>이력 로딩 중...</div>
        ) : analysisHistory && analysisHistory.data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analysisHistory.data.map((analysis) => (
              <AnalysisCard key={analysis.id} analysis={analysis} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">아직 분석 이력이 없습니다</h3>
              <p className="text-sm text-muted-foreground">
                첫 번째 사주 분석을 시작해보세요!
              </p>
            </div>
            <Button onClick={() => router.push(APP_CONFIG.routes.analysisNew)}>
              새 분석하기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
