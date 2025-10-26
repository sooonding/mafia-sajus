'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useSubscriptionContext } from '../context/subscription-context';

export function PaymentHistoryList() {
  const { paymentHistories, isLoadingHistories } = useSubscriptionContext();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DONE':
        return '완료';
      case 'ABORTED':
        return '실패';
      case 'CANCELED':
        return '취소';
      default:
        return status;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'DONE':
        return 'default';
      case 'ABORTED':
        return 'destructive';
      case 'CANCELED':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoadingHistories) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>결제 이력</CardTitle>
          <CardDescription>과거 결제 내역을 확인하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </CardContent>
      </Card>
    );
  }

  if (paymentHistories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>결제 이력</CardTitle>
          <CardDescription>과거 결제 내역을 확인하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">결제 이력이 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>결제 이력</CardTitle>
        <CardDescription>과거 결제 내역을 확인하세요</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {paymentHistories.map((history, index) => (
            <div key={history.id}>
              {index > 0 && <Separator className="my-4" />}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {format(new Date(history.paidAt), 'PPP', { locale: ko })}
                  </p>
                  <p className="text-sm text-muted-foreground">{history.orderId}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium">{history.amount.toLocaleString()}원</span>
                  <Badge variant={getStatusVariant(history.status) as any}>
                    {getStatusLabel(history.status)}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
