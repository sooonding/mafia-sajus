'use client';

import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SubscribeButton } from './subscribe-button';

export function ExpiredView() {
  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <h1 className="text-3xl font-bold">구독 관리</h1>
          <Badge variant="secondary">만료됨</Badge>
        </div>
        <p className="text-muted-foreground">Pro 구독이 만료되었습니다.</p>
      </div>

      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>구독이 만료되었습니다</CardTitle>
          </div>
          <CardDescription>
            Pro 혜택을 계속 이용하시려면 다시 구독해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              현재 무료 체험 상태로 전환되었습니다. 매월 1회 AI 분석을 이용하실 수 있습니다.
            </p>
          </div>

          <SubscribeButton />
        </CardContent>
      </Card>
    </div>
  );
}
