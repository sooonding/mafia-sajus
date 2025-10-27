import type { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '@/backend/hono/context';
import { requireAuth } from '@/backend/middleware/auth';
import { failure, respond, success } from '@/backend/http/response';
import {
  subscribeRequestSchema,
  cancelRequestSchema,
  resumeRequestSchema,
} from './schema';
import {
  getSubscription,
  getUsageInfo,
  getPaymentHistories,
  createProSubscription,
  cancelSubscription,
  resumeSubscription,
} from './service';
import { subscriptionErrorCodes } from './error';

export const registerSubscriptionRoutes = (app: Hono<AppEnv>) => {
  app.get('/api/subscription', requireAuth(), async (c) => {
    const userId = c.get('userId')!;
    const supabase = c.get('supabase');

    const subscription = await getSubscription(supabase, userId);

    return respond(c, success(subscription));
  });

  app.get('/api/usage', requireAuth(), async (c) => {
    const userId = c.get('userId')!;
    const supabase = c.get('supabase');

    try {
      const usageInfo = await getUsageInfo(supabase, userId);
      return respond(c, success(usageInfo));
    } catch (error: any) {
      return respond(c, failure(500, 'USAGE_FETCH_ERROR', error.message));
    }
  });

  app.get('/api/payment-histories', requireAuth(), async (c) => {
    const userId = c.get('userId')!;
    const supabase = c.get('supabase');

    const page = parseInt(c.req.query('page') ?? '1', 10);
    const limit = parseInt(c.req.query('limit') ?? '10', 10);

    const histories = await getPaymentHistories(supabase, userId, page, limit);

    return respond(c, success(histories));
  });

  app.post(
    '/api/subscription/subscribe',
    requireAuth(),
    zValidator('json', subscribeRequestSchema),
    async (c) => {
      const userId = c.get('userId')!;
      const supabase = c.get('supabase');
      const config = c.get('config');
      const { authKey } = c.req.valid('json');

      try {
        await createProSubscription(
          supabase,
          userId,
          authKey,
          config.toss.secretKey
        );
        return respond(c, success({ message: 'Pro 구독이 시작되었습니다' }));
      } catch (error: any) {
        if (error.code === subscriptionErrorCodes.subscriptionAlreadyActive) {
          return respond(c, failure(400, error.code, error.message));
        }
        return respond(
          c,
          failure(
            500,
            subscriptionErrorCodes.billingKeyIssueFailed,
            error.message
          )
        );
      }
    }
  );

  app.post(
    '/api/subscription/cancel',
    requireAuth(),
    zValidator('json', cancelRequestSchema),
    async (c) => {
      const userId = c.get('userId')!;
      const supabase = c.get('supabase');
      const { reason } = c.req.valid('json');

      try {
        const result = await cancelSubscription(supabase, userId, reason);
        return respond(c, success({
          status: 'canceled',
          nextBillingDate: result.nextBillingDate,
          message: '구독이 취소되었습니다',
        }));
      } catch (error: any) {
        if (error.code === subscriptionErrorCodes.subscriptionNotActive) {
          return respond(c, failure(400, error.code, error.message));
        }
        return respond(
          c,
          failure(500, 'CANCEL_SUBSCRIPTION_ERROR', error.message)
        );
      }
    }
  );

  app.post('/api/subscription/resume', requireAuth(), async (c) => {
    const userId = c.get('userId')!;
    const supabase = c.get('supabase');

    try {
      const result = await resumeSubscription(supabase, userId);
      return respond(c, success({
        status: 'active',
        nextBillingDate: result.nextBillingDate,
        message: '구독이 재개되었습니다',
      }));
    } catch (error: any) {
      if (error.code === subscriptionErrorCodes.subscriptionExpired) {
        return respond(c, failure(400, error.code, error.message));
      }
      return respond(
        c,
        failure(500, 'RESUME_SUBSCRIPTION_ERROR', error.message)
      );
    }
  });
};
