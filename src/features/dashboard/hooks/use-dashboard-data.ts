import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { apiClient } from '@/lib/remote/api-client';
import type { CurrentUserResponse } from '@/features/auth/lib/dto';
import type { UsageInfoResponse } from '@/features/dashboard/lib/dto';
import type { AnalysisHistoryResponse } from '@/features/analysis/lib/dto';

export function useCurrentUser() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const token = await getToken();
      const response = await apiClient.get<{ data: CurrentUserResponse }>('/api/me', {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useUsageInfo() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['usageInfo'],
    queryFn: async () => {
      const token = await getToken();
      const response = await apiClient.get<{ data: UsageInfoResponse }>('/api/me/usage', {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      });
      return response.data.data;
    },
    staleTime: 1 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useAnalysisHistory(page: number, limit: number) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ['analyses', { page, limit }],
    queryFn: async () => {
      const token = await getToken();
      const response = await apiClient.get<{ data: AnalysisHistoryResponse }>(
        `/api/analyses?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
          },
        }
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
