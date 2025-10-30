import { Hono } from 'hono';
import { errorBoundary } from '@/backend/middleware/error';
import { withAppContext } from '@/backend/middleware/context';
import { withSupabase } from '@/backend/middleware/supabase';
import { registerExampleRoutes } from '@/features/example/backend/route';
import { authRouter } from '@/features/auth/backend/route';
import { dashboardRouter } from '@/features/dashboard/backend/route';
import { analysisRouter } from '@/features/analysis/backend/route';
import { registerSubscriptionRoutes } from '@/features/subscription/backend/route';
import { registerWebhookRoutes } from '@/features/subscription/backend/webhook';
import { registerBillingCallbackRoutes } from '@/features/subscription/backend/billing-callback';
import type { AppEnv } from '@/backend/hono/context';

let singletonApp: Hono<AppEnv> | null = null;

export const createHonoApp = () => {
  if (singletonApp) {
    return singletonApp;
  }

  const app = new Hono<AppEnv>();

  app.use('*', errorBoundary());
  app.use('*', withAppContext());
  app.use('*', withSupabase());

  registerExampleRoutes(app);

  // 대시보드 관련 라우터 등록
  app.route('/api', authRouter);
  app.route('/api', dashboardRouter);
  app.route('/api', analysisRouter);

  // 구독 관련 라우터 등록
  registerSubscriptionRoutes(app);
  registerWebhookRoutes(app);
  registerBillingCallbackRoutes(app);

  singletonApp = app;

  return app;
};
