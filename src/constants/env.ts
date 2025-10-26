import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

// 빌드 타임에는 환경 변수 검증을 건너뜀
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

const _clientEnv = isBuildTime
  ? {
      success: true as const,
      data: {
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      },
    }
  : clientEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });

export type ClientEnv = z.infer<typeof clientEnvSchema>;

if (!_clientEnv.success) {
  console.error('환경 변수 검증 실패:', _clientEnv.error.flatten().fieldErrors);
  throw new Error('환경 변수를 확인하세요.');
}

export const env: ClientEnv = _clientEnv.data;
