'use client';

import { Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { APP_CONFIG } from '@/constants/app';
import { SubscribeButton } from './subscribe-button';
import { UsageInfoCard } from './usage-info-card';

export function FreeView() {
  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <h1 className="text-3xl font-bold">구독 관리</h1>
          <Badge variant="secondary">무료 체험</Badge>
        </div>
        <p className="text-muted-foreground">
          현재 무료 체험 중입니다. Pro로 업그레이드하여 더 많은 혜택을 누리세요.
        </p>
      </div>

      <UsageInfoCard />

      <Card>
        <CardHeader>
          <CardTitle>Pro 요금제</CardTitle>
          <CardDescription>AI 사주 분석을 무제한으로 이용하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="rounded-full bg-primary/10 p-1">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm">매월 {APP_CONFIG.subscription.pro.limit}회 AI 분석</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="rounded-full bg-primary/10 p-1">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm">고급 AI 모델 (Gemini 2.5 Pro) 사용</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="rounded-full bg-primary/10 p-1">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm">분석 결과 무제한 저장 및 조회</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="rounded-full bg-primary/10 p-1">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm">언제든지 취소 가능</span>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">월 구독료</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-3xl font-bold">
                  {APP_CONFIG.subscription.pro.price.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">원</span>
              </div>
            </div>
          </div>

          <SubscribeButton />
        </CardContent>
      </Card>
    </div>
  );
}
