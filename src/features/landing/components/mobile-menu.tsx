'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { SignOutButton } from '@clerk/nextjs';
import { APP_CONFIG } from '@/constants/app';
import { Button } from '@/components/ui/button';

interface MobileMenuProps {
  isSignedIn: boolean;
  onClose: () => void;
}

export function MobileMenu({ isSignedIn, onClose }: MobileMenuProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur md:hidden">
      <div className="container flex h-full flex-col px-4 py-6">
        {/* 닫기 버튼 */}
        <div className="flex justify-end">
          <button onClick={onClose} aria-label="메뉴 닫기">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 메뉴 링크 */}
        <nav className="mt-8 flex flex-col gap-4">
          {isSignedIn ? (
            <>
              <Link href={APP_CONFIG.routes.dashboard} onClick={onClose}>
                <Button variant="ghost" className="w-full justify-start">
                  대시보드
                </Button>
              </Link>
              <SignOutButton redirectUrl={APP_CONFIG.routes.home}>
                <Button variant="outline" className="w-full" onClick={onClose}>
                  로그아웃
                </Button>
              </SignOutButton>
            </>
          ) : (
            <>
              <Link href={APP_CONFIG.routes.signIn} onClick={onClose}>
                <Button variant="ghost" className="w-full justify-start">
                  로그인
                </Button>
              </Link>
              <Link href={APP_CONFIG.routes.signUp} onClick={onClose}>
                <Button className="w-full">회원가입</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
