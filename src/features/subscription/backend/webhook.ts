import type { Hono } from 'hono';
import type { AppEnv } from '@/backend/hono/context';
import { verifyWebhookSignature } from '@/backend/integrations/tosspayments/client';

export const registerWebhookRoutes = (app: Hono<AppEnv>) => {
  app.post('/api/webhooks/tosspayments', async (c) => {
    const payload = await c.req.text();
    const signature = c.req.header('X-Toss-Signature');
    const config = c.get('config');
    const logger = c.get('logger');

    if (
      !signature ||
      !verifyWebhookSignature(payload, signature, config.toss.webhookSecret)
    ) {
      logger.warn('Invalid webhook signature');
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const event = JSON.parse(payload);
    const supabase = c.get('supabase');

    switch (event.eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        await handlePaymentStatusChanged(supabase, event, logger);
        break;
      default:
        logger.info('Unknown webhook event type', { eventType: event.eventType });
    }

    return c.json({ success: true });
  });
};

async function handlePaymentStatusChanged(
  supabase: any,
  event: any,
  logger: any
) {
  const { orderId, status, paymentKey, amount, approvedAt } = event.data;

  const { data: existing } = await supabase
    .from('payment_histories')
    .select('id')
    .eq('order_id', orderId)
    .single();

  if (existing) {
    logger.info('Duplicate webhook event', { orderId });
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .limit(1)
    .single();

  if (!user) {
    logger.error('User not found for payment', { orderId });
    return;
  }

  await supabase.from('payment_histories').insert({
    user_id: user.id,
    payment_key: paymentKey,
    order_id: orderId,
    amount,
    status,
    paid_at: approvedAt,
  });

  if (status === 'ABORTED') {
    logger.warn('Payment failed', { orderId });
  }
}
