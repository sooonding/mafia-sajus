'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/constants/app';
import { cn } from '@/lib/utils';

interface CTAButtonProps {
  isSignedIn: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function CTAButton({
  isSignedIn,
  variant = 'default',
  size = 'default',
  className,
}: CTAButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (isSignedIn) {
      router.push(APP_CONFIG.routes.dashboard);
    } else {
      router.push(APP_CONFIG.routes.signUp);
    }
  };

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={cn(className)}
    >
      {isSignedIn ? '대시보드로 가기' : '무료로 시작하기'}
    </Button>
  );
}
