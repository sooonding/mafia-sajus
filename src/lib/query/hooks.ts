import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { extractApiErrorMessage } from '@/lib/remote/types';

/**
 * React Query 커스텀 훅
 */

/**
 * 뮤테이션 성공/실패 시 토스트 표시
 *
 * @example
 * ```ts
 * const mutation = useMutationWithToast(
 *   (data) => api.post('/endpoint', data),
 *   {
 *     successMessage: '저장되었습니다',
 *     errorMessage: '저장에 실패했습니다',
 *   }
 * );
 * ```
 */
export function useMutationWithToast<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    successMessage?: string;
    errorMessage?: string;
    onSuccess?: (data: TData) => void;
    onError?: (error: unknown) => void;
  }
) {
  const { toast } = useToast();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      if (options?.successMessage) {
        toast({ title: options.successMessage });
      }
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error, options?.errorMessage);
      toast({ title: message, variant: 'destructive' });
      options?.onError?.(error);
    },
  } as UseMutationOptions<TData, unknown, TVariables>);
}
