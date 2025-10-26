import { z } from 'zod';
import type { AppConfig } from '@/backend/hono/context';

const envSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),

  GEMINI_API_KEY: z.string().min(1).optional(),

  TOSS_SECRET_KEY: z.string().min(1).optional(),
  TOSS_CLIENT_KEY: z.string().min(1).optional(),
  TOSS_WEBHOOK_SECRET: z.string().min(1).optional(),
});

let cachedConfig: AppConfig | null = null;

export const getAppConfig = (): AppConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
    CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,

    GEMINI_API_KEY: process.env.GEMINI_API_KEY,

    TOSS_SECRET_KEY: process.env.TOSS_SECRET_KEY,
    TOSS_CLIENT_KEY: process.env.TOSS_CLIENT_KEY,
    TOSS_WEBHOOK_SECRET: process.env.TOSS_WEBHOOK_SECRET,
  });

  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid backend configuration: ${messages}`);
  }

  cachedConfig = {
    supabase: {
      url: parsed.data.SUPABASE_URL || '',
      serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY || '',
    },
    clerk: {
      secretKey: parsed.data.CLERK_SECRET_KEY || '',
      publishableKey: parsed.data.CLERK_PUBLISHABLE_KEY || '',
      webhookSigningSecret: parsed.data.CLERK_WEBHOOK_SIGNING_SECRET || '',
    },
    gemini: {
      apiKey: parsed.data.GEMINI_API_KEY || '',
    },
    toss: {
      secretKey: parsed.data.TOSS_SECRET_KEY || '',
      clientKey: parsed.data.TOSS_CLIENT_KEY || '',
      webhookSecret: parsed.data.TOSS_WEBHOOK_SECRET || '',
    },
  } satisfies AppConfig;

  return cachedConfig;
};
