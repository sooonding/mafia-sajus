'use client';

import { AnalysisNewProvider } from '@/features/analysis/context/analysis-new-context';
import { AnalysisNewPage } from '@/features/analysis/components/analysis-new-page';

/**
 * 새 분석하기 페이지 엔트리
 */
export default function AnalysisNew() {
  return (
    <AnalysisNewProvider>
      <AnalysisNewPage />
    </AnalysisNewProvider>
  );
}
