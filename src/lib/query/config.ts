import { QueryClient, type DefaultOptions } from '@tanstack/react-query';

/**
 * React Query 전역 설정
 */

const defaultOptions: DefaultOptions = {
  queries: {
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분 (구 cacheTime)
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: 0,
  },
};

export const createQueryClient = () =>
  new QueryClient({ defaultOptions });
