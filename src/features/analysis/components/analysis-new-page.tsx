'use client';

import { useEffect } from 'react';
import { useAnalysisNew } from '../context/analysis-new-context';
import { UsageDisplay } from './usage-display';
import { AnalysisForm } from './analysis-form';
import { ErrorAlert } from './error-alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { APP_CONFIG } from '@/constants/app';

/**
 * 새 분석하기 메인 페이지 컴포넌트
 */
export function AnalysisNewPage() {
  const { fetchUsage, state } = useAnalysisNew();
  const router = useRouter();

  useEffect(() => {
    fetchUsage();
  }, []);

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      {/* 상단 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(APP_CONFIG.routes.dashboard)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          대시보드로
        </Button>
        <h1 className="text-3xl font-bold">새 분석하기</h1>
        <p className="text-muted-foreground mt-2">
          AI가 당신의 사주를 분석합니다
        </p>
      </div>

      {/* 사용량 표시 */}
      <UsageDisplay />

      {/* 에러 표시 */}
      {state.usageError && (
        <ErrorAlert
          message="사용량 정보를 불러오지 못했습니다"
          onRetry={fetchUsage}
        />
      )}

      {state.submitError && (
        <ErrorAlert message={state.submitError} />
      )}

      {/* 분석 폼 */}
      <Card className="p-6 mt-6">
        <AnalysisForm />
      </Card>

      {/* 로딩 오버레이 */}
      {state.isSubmitting && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">AI가 사주를 분석하고 있습니다...</p>
          </div>
        </div>
      )}
    </div>
  );
}
