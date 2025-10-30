'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SubscriptionProvider } from '@/features/subscription/context/subscription-context';
import { SubscriptionContent } from '@/features/subscription/components/subscription-content';
import { toast } from '@/hooks/use-toast';

function PaymentStatusHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const status = searchParams.get('status');
    const message = searchParams.get('message');

    if (status === 'success') {
      toast({
        title: '구독 성공',
        description: 'Pro 구독이 시작되었습니다',
      });
      // URL에서 쿼리 파라미터 제거
      router.replace('/subscription');
    } else if (status === 'error') {
      toast({
        title: '구독 실패',
        description: message || '구독 처리 중 오류가 발생했습니다',
        variant: 'destructive',
      });
      // URL에서 쿼리 파라미터 제거
      router.replace('/subscription');
    } else if (status === 'fail') {
      toast({
        title: '결제 인증 실패',
        description: message || '결제 인증에 실패했습니다',
        variant: 'destructive',
      });
      // URL에서 쿼리 파라미터 제거
      router.replace('/subscription');
    }
  }, [searchParams, router]);

  return null;
}

export default function SubscriptionPage() {
  return (
    <SubscriptionProvider>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <PaymentStatusHandler />
      </Suspense>
      <SubscriptionContent />
    </SubscriptionProvider>
  );
}
