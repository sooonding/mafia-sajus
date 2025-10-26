'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { SignOutButton } from '@clerk/nextjs';
import { APP_CONFIG } from '@/constants/app';
import { Button } from '@/components/ui/button';
import { MobileMenu } from './mobile-menu';

interface HeaderProps {
  isSignedIn: boolean;
}

export function Header({ isSignedIn }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* 로고 */}
        <Link href={APP_CONFIG.routes.home} className="text-xl font-bold">
          {APP_CONFIG.name}
        </Link>

        {/* 데스크톱 네비게이션 */}
        <nav className="hidden items-center gap-4 md:flex">
          {isSignedIn ? (
            <>
              <Link href={APP_CONFIG.routes.dashboard}>
                <Button variant="ghost">대시보드</Button>
              </Link>
              <SignOutButton redirectUrl={APP_CONFIG.routes.home}>
                <Button variant="outline">로그아웃</Button>
              </SignOutButton>
            </>
          ) : (
            <>
              <Link href={APP_CONFIG.routes.signIn}>
                <Button variant="ghost">로그인</Button>
              </Link>
              <Link href={APP_CONFIG.routes.signUp}>
                <Button>회원가입</Button>
              </Link>
            </>
          )}
        </nav>

        {/* 모바일 햄버거 버튼 */}
        <button
          className="md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="모바일 메뉴 열기"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* 모바일 메뉴 오버레이 */}
      {isMobileMenuOpen && (
        <MobileMenu
          isSignedIn={isSignedIn}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      )}
    </header>
  );
}
