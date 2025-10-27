'use client';

import React, { createContext, useContext, useReducer } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiClient, extractApiErrorMessage } from '@/lib/remote/api-client';
import type { CreateAnalysisRequest } from '../backend/schema';
import { APP_CONFIG } from '@/constants/app';

/**
 * 사용량 정보 인터페이스
 */
export interface UsageInfo {
  subscriptionTier: 'free' | 'pro';
  used: number;
  limit: number;
  remaining: number;
  nextResetDate?: Date;
}

/**
 * 사용량 API 응답 인터페이스
 */
interface UsageResponse {
  subscriptionTier: 'free' | 'pro';
  used: number;
  limit: number;
  remaining: number;
  nextResetDate?: string;
}

/**
 * 분석 생성 API 응답 인터페이스
 */
interface AnalysisResponse {
  id: string;
  userId: string;
  birthDate: string;
  birthTime?: string;
  isLunar: boolean;
  gender: 'male' | 'female';
  result: Record<string, unknown>;
  modelUsed: string;
  createdAt: string;
}

/**
 * Context 상태 인터페이스
 */
export interface AnalysisNewState {
  usageInfo: UsageInfo | null;
  isLoadingUsage: boolean;
  usageError: Error | null;
  isSubmitting: boolean;
  submitError: string | null;
}

/**
 * Context 액션 타입
 */
export type AnalysisNewAction =
  | { type: 'FETCH_USAGE_START' }
  | { type: 'FETCH_USAGE_SUCCESS'; payload: UsageInfo }
  | { type: 'FETCH_USAGE_ERROR'; payload: Error }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; payload: string }
  | { type: 'RESET_ERROR' };

/**
 * Context value 인터페이스
 */
export interface AnalysisNewContextValue {
  state: AnalysisNewState;
  dispatch: React.Dispatch<AnalysisNewAction>;
  canSubmit: boolean;
  usageExceeded: boolean;
  isLoading: boolean;
  fetchUsage: () => Promise<void>;
  submitAnalysis: (data: CreateAnalysisRequest) => Promise<string>;
  resetError: () => void;
}

const AnalysisNewContext = createContext<AnalysisNewContextValue | null>(null);

/**
 * Reducer
 */
const initialState: AnalysisNewState = {
  usageInfo: null,
  isLoadingUsage: false,
  usageError: null,
  isSubmitting: false,
  submitError: null,
};

function analysisNewReducer(
  state: AnalysisNewState,
  action: AnalysisNewAction
): AnalysisNewState {
  switch (action.type) {
    case 'FETCH_USAGE_START':
      return { ...state, isLoadingUsage: true, usageError: null };
    case 'FETCH_USAGE_SUCCESS':
      return { ...state, isLoadingUsage: false, usageInfo: action.payload, usageError: null };
    case 'FETCH_USAGE_ERROR':
      return { ...state, isLoadingUsage: false, usageError: action.payload };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, submitError: null };
    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false, submitError: null };
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, submitError: action.payload };
    case 'RESET_ERROR':
      return { ...state, submitError: null, usageError: null };
    default:
      return state;
  }
}

/**
 * Provider 컴포넌트
 */
export function AnalysisNewProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(analysisNewReducer, initialState);
  const router = useRouter();
  const { getToken } = useAuth();

  // React Query: 사용량 조회
  const { refetch: refetchUsage } = useQuery({
    queryKey: ['analysis', 'usage'],
    queryFn: async () => {
      const token = await getToken();
      const response = await apiClient.get<{ data: UsageResponse }>('/api/analyses/usage', {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      });
      return response.data.data;
    },
    enabled: false, // 수동 조회
  });

  // React Query: 분석 요청
  const analysisMutation = useMutation({
    mutationFn: async (data: CreateAnalysisRequest) => {
      const token = await getToken();
      const response = await apiClient.post<{ data: AnalysisResponse }>('/api/analyses', data, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      });
      return response.data.data;
    },
  });

  // 액션 함수: 사용량 조회
  const fetchUsage = async () => {
    dispatch({ type: 'FETCH_USAGE_START' });
    try {
      const result = await refetchUsage();
      if (result.data) {
        dispatch({
          type: 'FETCH_USAGE_SUCCESS',
          payload: {
            subscriptionTier: result.data.subscriptionTier,
            used: result.data.used,
            limit: result.data.limit,
            remaining: result.data.remaining,
            nextResetDate: result.data.nextResetDate ? new Date(result.data.nextResetDate) : undefined,
          },
        });
      } else if (result.error) {
        dispatch({ type: 'FETCH_USAGE_ERROR', payload: result.error as Error });
      }
    } catch (error) {
      dispatch({ type: 'FETCH_USAGE_ERROR', payload: error as Error });
    }
  };

  // 액션 함수: 분석 요청
  const submitAnalysis = async (data: CreateAnalysisRequest): Promise<string> => {
    dispatch({ type: 'SUBMIT_START' });
    try {
      const result = await analysisMutation.mutateAsync(data);
      dispatch({ type: 'SUBMIT_SUCCESS' });

      // 사용량 갱신
      await fetchUsage();

      return result.id;
    } catch (error) {
      const message = extractApiErrorMessage(error, '분석 요청 중 오류가 발생했습니다');
      dispatch({ type: 'SUBMIT_ERROR', payload: message });
      throw error;
    }
  };

  // 액션 함수: 에러 초기화
  const resetError = () => {
    dispatch({ type: 'RESET_ERROR' });
  };

  // 파생 데이터
  const canSubmit = Boolean(
    state.usageInfo && state.usageInfo.remaining > 0 && !state.isSubmitting
  );
  const usageExceeded = state.usageInfo?.remaining === 0;
  const isLoading = state.isLoadingUsage || state.isSubmitting;

  const value: AnalysisNewContextValue = {
    state,
    dispatch,
    canSubmit,
    usageExceeded,
    isLoading,
    fetchUsage,
    submitAnalysis,
    resetError,
  };

  return (
    <AnalysisNewContext.Provider value={value}>
      {children}
    </AnalysisNewContext.Provider>
  );
}

/**
 * Custom Hook
 */
export const useAnalysisNew = () => {
  const context = useContext(AnalysisNewContext);
  if (!context) {
    throw new Error('useAnalysisNew must be used within AnalysisNewProvider');
  }
  return context;
};
