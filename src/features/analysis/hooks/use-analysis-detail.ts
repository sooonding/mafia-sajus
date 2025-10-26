'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { apiClient } from '@/lib/remote/api-client';
import type { AnalysisDetailResponse } from '../lib/dto';

export function useAnalysisDetail(analysisId: string) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['analysis', analysisId],
    queryFn: async () => {
      const token = await getToken();
      const response = await apiClient.get<AnalysisDetailResponse>(
        `/api/analyses/${analysisId}`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
          },
        }
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
