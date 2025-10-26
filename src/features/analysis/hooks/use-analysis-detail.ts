'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { AnalysisDetailResponse } from '../lib/dto';

export function useAnalysisDetail(analysisId: string) {
  return useQuery({
    queryKey: ['analysis', analysisId],
    queryFn: async () => {
      const response = await apiClient.get<AnalysisDetailResponse>(
        `/analyses/${analysisId}`
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
}
