'use client';

import { APP_CONFIG } from '@/constants/app';

export function Footer() {
  return (
    <footer className="border-t bg-muted/40 py-8">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {APP_CONFIG.name}. All rights reserved.
      </div>
    </footer>
  );
}
