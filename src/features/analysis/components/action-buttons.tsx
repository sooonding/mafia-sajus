'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface ActionButtonsProps {
  onBackToDashboard: () => void;
}

export function ActionButtons({ onBackToDashboard }: ActionButtonsProps) {
  return (
    <div className="flex justify-center mt-8">
      <Button onClick={onBackToDashboard} variant="outline" size="lg">
        <ArrowLeft className="mr-2 h-4 w-4" />
        대시보드로 돌아가기
      </Button>
    </div>
  );
}
