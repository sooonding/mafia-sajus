'use client';

import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ErrorPageProps {
  title: string;
  message: string;
  action: {
    label: string;
    onClick: () => void;
  };
}

export function ErrorPage({ title, message, action }: ErrorPageProps) {
  return (
    <div className="container max-w-md mx-auto py-16 text-center">
      <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-muted-foreground mb-6">{message}</p>
      <Button onClick={action.onClick}>{action.label}</Button>
    </div>
  );
}
