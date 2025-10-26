import { create } from 'zustand';

/**
 * 전역 로딩 상태 관리 (Zustand)
 */

interface LoadingState {
  isLoading: boolean;
  message?: string;
  startLoading: (message?: string) => void;
  stopLoading: () => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  message: undefined,
  startLoading: (message) => set({ isLoading: true, message }),
  stopLoading: () => set({ isLoading: false, message: undefined }),
}));
