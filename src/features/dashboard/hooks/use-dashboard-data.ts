import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type { CurrentUserResponse } from '@/features/auth/lib/dto';
import type { UsageInfoResponse } from '@/features/dashboard/lib/dto';
import type { AnalysisHistoryResponse } from '@/features/analysis/lib/dto';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: CurrentUserResponse }>('/api/me');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useUsageInfo() {
  return useQuery({
    queryKey: ['usageInfo'],
    queryFn: async () => {
      const response = await apiClient.get<{ data: UsageInfoResponse }>('/api/me/usage');
      return response.data.data;
    },
    staleTime: 1 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useAnalysisHistory(page: number, limit: number) {
  return useQuery({
    queryKey: ['analyses', { page, limit }],
    queryFn: async () => {
      const response = await apiClient.get<{ data: AnalysisHistoryResponse }>(
        `/api/analyses?page=${page}&limit=${limit}`
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateDashboard() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['usageInfo'] });
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
    },
    invalidateUser: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['usageInfo'] });
    },
    invalidatePage: (page: number) => {
      queryClient.invalidateQueries({ queryKey: ['analyses', { page }] });
    },
  };
}
