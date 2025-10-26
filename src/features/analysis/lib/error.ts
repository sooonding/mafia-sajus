'use client';

import { isAxiosError } from 'axios';

export type AnalysisErrorType =
  | 'forbidden'
  | 'not-found'
  | 'network'
  | 'unknown';

export function getAnalysisErrorType(error: unknown): AnalysisErrorType {
  if (!error) return 'unknown';

  // Axios ��x ��
  if (isAxiosError(error)) {
    const code = (error.response?.data as any)?.error?.code;

    if (code === 'ANALYSIS_FORBIDDEN') {
      return 'forbidden';
    }

    if (code === 'ANALYSIS_NOT_FOUND') {
      return 'not-found';
    }

    // $��l $X
    if (!error.response) {
      return 'network';
    }
  }

  // | $��l ��
  if (error instanceof Error && error.message.includes('Network')) {
    return 'network';
  }

  return 'unknown';
}
