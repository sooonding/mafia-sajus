'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

/**
 * 에러 알림 컴포넌트
 */
export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>오류</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            재시도
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
