import type { SupabaseClient } from '@supabase/supabase-js';
import { addMonths } from 'date-fns';
import type { Subscription, PaymentHistory, UsageInfo } from './schema';
import { subscriptionRowSchema, paymentHistoryRowSchema } from './schema';
import { subscriptionErrorCodes } from './error';
import {
  issueBillingKey,
  approveBilling,
  deleteBillingKey,
  TOSS_CONSTANTS,
} from '@/backend/integrations/tosspayments/client';
import { checkUsageLimit } from '@/backend/services/usage';

export async function getSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'canceled'])
    .single();

  if (error || !data) {
    return null;
  }

  const row = subscriptionRowSchema.parse(data);

  return {
    id: row.id,
    plan: row.plan,
    status: row.status,
    billingKey: row.billing_key ?? undefined,
    customerKey: row.customer_key ?? undefined,
    startedAt: row.started_at ?? undefined,
    nextBillingDate: row.next_billing_date ?? undefined,
    canceledAt: row.canceled_at ?? undefined,
  };
}

export async function getUsageInfo(
  supabase: SupabaseClient,
  userId: string
): Promise<UsageInfo> {
  const usage = await checkUsageLimit(supabase, userId);

  return {
    used: usage.used,
    limit: usage.limit,
    remaining: usage.remaining,
    nextResetDate: usage.nextResetDate?.toISOString(),
  };
}

export async function getPaymentHistories(
  supabase: SupabaseClient,
  userId: string,
  page: number = 1,
  limit: number = 10
): Promise<PaymentHistory[]> {
  const offset = (page - 1) * limit;

  const { data, error } = await supabase
    .from('payment_histories')
    .select('*')
    .eq('user_id', userId)
    .order('paid_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const parsed = paymentHistoryRowSchema.parse(row);
    return {
      id: parsed.id,
      paymentKey: parsed.payment_key,
      orderId: parsed.order_id,
      amount: parsed.amount,
      status: parsed.status,
      paidAt: parsed.paid_at,
    };
  });
}

export async function createProSubscription(
  supabase: SupabaseClient,
  userId: string,
  authKey: string,
  secretKey: string
): Promise<void> {
  const existingSub = await getSubscription(supabase, userId);

  if (existingSub && existingSub.status === 'active') {
    const error = new Error('이미 활성 구독이 있습니다');
    (error as any).code = subscriptionErrorCodes.subscriptionAlreadyActive;
    throw error;
  }

  let billingKey: string | null = null;

  try {
    const customerKey = userId;
    const orderId = `order_${Date.now()}_${userId.slice(0, 8)}`;

    const { billingKey: issuedKey } = await issueBillingKey(
      authKey,
      customerKey,
      secretKey
    );
    billingKey = issuedKey;

    const { paymentKey, approvedAt } = await approveBilling(
      billingKey,
      TOSS_CONSTANTS.PRO_PRICE,
      orderId,
      TOSS_CONSTANTS.ORDER_NAME,
      secretKey
    );

    const now = new Date();
    const nextBillingDate = addMonths(now, 1);

    const { error: userError } = await supabase
      .from('users')
      .update({ subscription_tier: 'pro' })
      .eq('id', userId);

    if (userError) {
      throw userError;
    }

    const { error: subError } = await supabase.from('subscriptions').insert({
      user_id: userId,
      plan: 'pro',
      status: 'active',
      billing_key: billingKey,
      customer_key: customerKey,
      started_at: now.toISOString(),
      next_billing_date: nextBillingDate.toISOString(),
    });

    if (subError) {
      throw subError;
    }

    const { error: paymentError } = await supabase
      .from('payment_histories')
      .insert({
        user_id: userId,
        payment_key: paymentKey,
        order_id: orderId,
        amount: TOSS_CONSTANTS.PRO_PRICE,
        status: 'DONE',
        paid_at: approvedAt.toISOString(),
      });

    if (paymentError) {
      throw paymentError;
    }
  } catch (error) {
    if (billingKey) {
      try {
        await deleteBillingKey(billingKey, secretKey);
      } catch {
        // 빌링키 삭제 실패는 무시
      }
    }

    if ((error as any).code) {
      throw error;
    }

    const serviceError = new Error('Pro 구독 생성에 실패했습니다');
    (serviceError as any).code = subscriptionErrorCodes.billingKeyIssueFailed;
    throw serviceError;
  }
}

export async function cancelSubscription(
  supabase: SupabaseClient,
  userId: string,
  reason?: string
): Promise<{ nextBillingDate: Date }> {
  const subscription = await getSubscription(supabase, userId);

  if (!subscription) {
    const error = new Error('구독 정보를 찾을 수 없습니다');
    (error as any).code = subscriptionErrorCodes.subscriptionNotFound;
    throw error;
  }

  if (subscription.status !== 'active') {
    const error = new Error('활성 구독이 아닙니다');
    (error as any).code = subscriptionErrorCodes.subscriptionNotActive;
    throw error;
  }

  const now = new Date();

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: now.toISOString(),
    })
    .eq('id', subscription.id);

  if (error) {
    throw error;
  }

  if (reason) {
    console.log(`Subscription canceled. Reason: ${reason}`);
  }

  return {
    nextBillingDate: new Date(subscription.nextBillingDate!),
  };
}

export async function resumeSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<{ nextBillingDate: Date }> {
  const subscription = await getSubscription(supabase, userId);

  if (!subscription) {
    const error = new Error('구독 정보를 찾을 수 없습니다');
    (error as any).code = subscriptionErrorCodes.subscriptionNotFound;
    throw error;
  }

  if (subscription.status !== 'canceled') {
    const error = new Error('취소된 구독이 아닙니다');
    (error as any).code = subscriptionErrorCodes.subscriptionAlreadyActive;
    throw error;
  }

  const now = new Date();
  const nextBillingDate = new Date(subscription.nextBillingDate!);

  if (nextBillingDate <= now) {
    const error = new Error('구독이 이미 만료되었습니다');
    (error as any).code = subscriptionErrorCodes.subscriptionExpired;
    throw error;
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      canceled_at: null,
    })
    .eq('id', subscription.id);

  if (error) {
    throw error;
  }

  return {
    nextBillingDate,
  };
}
