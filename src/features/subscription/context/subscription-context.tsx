'use client';

import React, { createContext, useContext, useReducer, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInDays } from 'date-fns';
import { apiClient, extractApiErrorMessage } from '@/lib/remote/api-client';
import { APP_CONFIG } from '@/constants/app';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/nextjs';
import type { Subscription, UsageInfo, PaymentHistory } from '../backend/schema';

interface SubscriptionPageState {
  paymentFlow: 'idle' | 'processing' | 'success' | 'error';
  paymentError: string | null;
  cancelModalOpen: boolean;
  resumeModalOpen: boolean;
  selectedReason: string | null;
}

type SubscriptionPageAction =
  | { type: 'PAYMENT_START' }
  | { type: 'PAYMENT_SUCCESS' }
  | { type: 'PAYMENT_ERROR'; payload: { error: string } }
  | { type: 'PAYMENT_RESET' }
  | { type: 'OPEN_CANCEL_MODAL' }
  | { type: 'CLOSE_CANCEL_MODAL' }
  | { type: 'SET_CANCEL_REASON'; payload: { reason: string | null } }
  | { type: 'OPEN_RESUME_MODAL' }
  | { type: 'CLOSE_RESUME_MODAL' };

const initialState: SubscriptionPageState = {
  paymentFlow: 'idle',
  paymentError: null,
  cancelModalOpen: false,
  resumeModalOpen: false,
  selectedReason: null,
};

function subscriptionPageReducer(
  state: SubscriptionPageState,
  action: SubscriptionPageAction
): SubscriptionPageState {
  switch (action.type) {
    case 'PAYMENT_START':
      return {
        ...state,
        paymentFlow: 'processing',
        paymentError: null,
      };

    case 'PAYMENT_SUCCESS':
      return {
        ...state,
        paymentFlow: 'success',
        paymentError: null,
      };

    case 'PAYMENT_ERROR':
      return {
        ...state,
        paymentFlow: 'error',
        paymentError: action.payload.error,
      };

    case 'PAYMENT_RESET':
      return {
        ...state,
        paymentFlow: 'idle',
        paymentError: null,
      };

    case 'OPEN_CANCEL_MODAL':
      return {
        ...state,
        cancelModalOpen: true,
        selectedReason: null,
      };

    case 'CLOSE_CANCEL_MODAL':
      return {
        ...state,
        cancelModalOpen: false,
        selectedReason: null,
      };

    case 'SET_CANCEL_REASON':
      return {
        ...state,
        selectedReason: action.payload.reason,
      };

    case 'OPEN_RESUME_MODAL':
      return {
        ...state,
        resumeModalOpen: true,
      };

    case 'CLOSE_RESUME_MODAL':
      return {
        ...state,
        resumeModalOpen: false,
      };

    default:
      return state;
  }
}

interface SubscriptionContextValue {
  subscription: Subscription | null;
  usageInfo: UsageInfo | null;
  paymentHistories: PaymentHistory[];
  isLoadingSubscription: boolean;
  isLoadingUsage: boolean;
  isLoadingHistories: boolean;

  state: SubscriptionPageState;
  dispatch: React.Dispatch<SubscriptionPageAction>;

  subscriptionTier: 'free' | 'pro';
  isProActive: boolean;
  isCanceled: boolean;
  isExpired: boolean;
  canCancel: boolean;
  canResume: boolean;
  daysUntilExpiry: number | null;

  handleSubscribe: () => Promise<void>;
  handleCancel: () => Promise<void>;
  handleResume: () => Promise<void>;
  openCancelModal: () => void;
  closeCancelModal: () => void;
  openResumeModal: () => void;
  closeResumeModal: () => void;
  setCancelReason: (reason: string | null) => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(subscriptionPageReducer, initialState);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useUser();

  const { data: subscription = null, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Subscription | null }>('/api/subscription');
      return res.data.data;
    },
  });

  const { data: usageInfo = null, isLoading: isLoadingUsage } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: UsageInfo }>('/api/usage');
      return res.data.data;
    },
  });

  const { data: paymentHistories = [], isLoading: isLoadingHistories } = useQuery({
    queryKey: ['payment-histories'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: PaymentHistory[] }>('/api/payment-histories');
      return res.data.data;
    },
  });

  const handleSubscribe = useCallback(async () => {
    if (!user?.id) {
      toast({
        title: '인증이 필요합니다',
        description: '로그인 후 다시 시도해주세요.',
        variant: 'destructive',
      });
      return;
    }

    dispatch({ type: 'PAYMENT_START' });

    try {
      const { loadTossPayments } = await import('@tosspayments/payment-sdk');
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

      if (!clientKey) {
        throw new Error('토스페이먼츠 클라이언트 키가 설정되지 않았습니다.');
      }

      const tossPayments = await loadTossPayments(clientKey);
      const customerKey = user.id;
      const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      await tossPayments.requestBillingAuth('카드', {
        customerKey,
        successUrl: `${window.location.origin}/api/billing/success`,
        failUrl: `${window.location.origin}/api/billing/fail`,
      });
    } catch (error) {
      const errorMessage = extractApiErrorMessage(error, '결제 요청에 실패했습니다.');
      dispatch({ type: 'PAYMENT_ERROR', payload: { error: errorMessage } });
      toast({
        title: '결제 요청 실패',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  const cancelMutation = useMutation({
    mutationFn: async (reason?: string) => {
      return apiClient.post('/api/subscription/cancel', { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({ title: '구독이 취소되었습니다' });
    },
    onError: (error: unknown) => {
      toast({
        title: '구독 취소에 실패했습니다',
        description: extractApiErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const handleCancel = useCallback(async () => {
    await cancelMutation.mutateAsync(state.selectedReason ?? undefined);
    dispatch({ type: 'CLOSE_CANCEL_MODAL' });
  }, [cancelMutation, state.selectedReason]);

  const resumeMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/api/subscription/resume');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast({ title: '구독이 재개되었습니다' });
    },
    onError: (error: unknown) => {
      toast({
        title: '구독 재개에 실패했습니다',
        description: extractApiErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const handleResume = useCallback(async () => {
    await resumeMutation.mutateAsync();
    dispatch({ type: 'CLOSE_RESUME_MODAL' });
  }, [resumeMutation]);

  const subscriptionTier = subscription?.plan ?? 'free';
  const isProActive = subscription?.plan === 'pro' && subscription?.status === 'active';
  const isCanceled = subscription?.status === 'canceled';
  const isExpired = subscription?.status === 'expired';
  const canCancel = isProActive;
  const canResume =
    isCanceled && subscription?.nextBillingDate
      ? new Date(subscription.nextBillingDate) > new Date()
      : false;
  const daysUntilExpiry = subscription?.nextBillingDate
    ? differenceInDays(new Date(subscription.nextBillingDate), new Date())
    : null;

  const value = useMemo(
    () => ({
      subscription,
      usageInfo,
      paymentHistories,
      isLoadingSubscription,
      isLoadingUsage,
      isLoadingHistories,

      state,
      dispatch,

      subscriptionTier,
      isProActive,
      isCanceled,
      isExpired,
      canCancel,
      canResume,
      daysUntilExpiry,

      handleSubscribe,
      handleCancel,
      handleResume,
      openCancelModal: () => dispatch({ type: 'OPEN_CANCEL_MODAL' }),
      closeCancelModal: () => dispatch({ type: 'CLOSE_CANCEL_MODAL' }),
      openResumeModal: () => dispatch({ type: 'OPEN_RESUME_MODAL' }),
      closeResumeModal: () => dispatch({ type: 'CLOSE_RESUME_MODAL' }),
      setCancelReason: (reason: string | null) =>
        dispatch({ type: 'SET_CANCEL_REASON', payload: { reason } }),
    }),
    [
      subscription,
      usageInfo,
      paymentHistories,
      isLoadingSubscription,
      isLoadingUsage,
      isLoadingHistories,
      state,
      subscriptionTier,
      isProActive,
      isCanceled,
      isExpired,
      canCancel,
      canResume,
      daysUntilExpiry,
      handleSubscribe,
      handleCancel,
      handleResume,
    ]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscriptionContext() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscriptionContext must be used within SubscriptionProvider');
  }
  return context;
}
