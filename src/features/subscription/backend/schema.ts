import { z } from 'zod';

export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  plan: z.enum(['free', 'pro']),
  status: z.enum(['active', 'canceled', 'expired']),
  billingKey: z.string().optional(),
  customerKey: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  nextBillingDate: z.string().datetime().optional(),
  canceledAt: z.string().datetime().optional(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

export const usageInfoSchema = z.object({
  used: z.number().int().min(0),
  limit: z.number().int().min(1),
  remaining: z.number().int().min(0),
  nextResetDate: z.string().datetime().optional(),
});

export type UsageInfo = z.infer<typeof usageInfoSchema>;

export const paymentHistorySchema = z.object({
  id: z.string().uuid(),
  paymentKey: z.string(),
  orderId: z.string(),
  amount: z.number().int().min(0),
  status: z.enum(['DONE', 'ABORTED', 'CANCELED']),
  paidAt: z.string().datetime(),
});

export type PaymentHistory = z.infer<typeof paymentHistorySchema>;

export const subscribeRequestSchema = z.object({
  authKey: z.string().min(1, '인증 키가 필요합니다'),
});

export type SubscribeRequest = z.infer<typeof subscribeRequestSchema>;

export const cancelRequestSchema = z.object({
  reason: z.string().optional(),
});

export type CancelRequest = z.infer<typeof cancelRequestSchema>;

export const resumeRequestSchema = z.object({});

export type ResumeRequest = z.infer<typeof resumeRequestSchema>;

export const subscriptionRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  plan: z.enum(['free', 'pro']),
  status: z.enum(['active', 'canceled', 'expired']),
  billing_key: z.string().nullable(),
  customer_key: z.string().nullable(),
  started_at: z.string().nullable(),
  next_billing_date: z.string().nullable(),
  canceled_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SubscriptionRow = z.infer<typeof subscriptionRowSchema>;

export const paymentHistoryRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  payment_key: z.string(),
  order_id: z.string(),
  amount: z.number().int(),
  status: z.enum(['DONE', 'ABORTED', 'CANCELED']),
  paid_at: z.string(),
  created_at: z.string(),
});

export type PaymentHistoryRow = z.infer<typeof paymentHistoryRowSchema>;
