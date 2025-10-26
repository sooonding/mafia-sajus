import type { Context } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AppLogger = Pick<Console, 'info' | 'error' | 'warn' | 'debug'>;

export type AppConfig = {
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
  clerk: {
    secretKey: string;
    publishableKey: string;
    webhookSigningSecret: string;
  };
  gemini: {
    apiKey: string;
  };
  toss: {
    secretKey: string;
    clientKey: string;
    webhookSecret: string;
  };
};

export type AppVariables = {
  supabase: SupabaseClient;
  logger: AppLogger;
  config: AppConfig;
  clerkUserId?: string;
  userId?: string;
};

export type AppEnv = {
  Variables: AppVariables;
};

export type AppContext = Context<AppEnv>;

export const contextKeys = {
  supabase: 'supabase',
  logger: 'logger',
  config: 'config',
  clerkUserId: 'clerkUserId',
  userId: 'userId',
} as const satisfies Record<keyof AppVariables, keyof AppVariables>;

export const getSupabase = (c: AppContext) =>
  c.get(contextKeys.supabase) as SupabaseClient;

export const getLogger = (c: AppContext) =>
  c.get(contextKeys.logger) as AppLogger;

export const getConfig = (c: AppContext) =>
  c.get(contextKeys.config) as AppConfig;
