'use client';

import { useLoadingStore } from '@/stores/loading';

/**
 * 전역 로딩 오버레이
 *
 * 사용 예시:
 * ```tsx
 * import { useLoadingStore } from '@/stores/loading';
 *
 * const { startLoading, stopLoading } = useLoadingStore();
 *
 * const handleSubmit = async () => {
 *   startLoading('AI가 사주를 분석하고 있습니다...');
 *   try {
 *     await analysisMutation.mutateAsync(data);
 *   } finally {
 *     stopLoading();
 *   }
 * };
 * ```
 */
export function LoadingOverlay() {
  const { isLoading, message } = useLoadingStore();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}
