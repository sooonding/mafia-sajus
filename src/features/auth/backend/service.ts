import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurrentUserResponse } from './schema';

/**
 * 현재 사용자 정보 조회
 *
 * @param supabase Supabase 클라이언트
 * @param userId 사용자 UUID
 * @returns 사용자 정보
 * @throws {Error} 사용자를 찾을 수 없는 경우
 */
export async function getCurrentUser(
  supabase: SupabaseClient,
  userId: string
): Promise<CurrentUserResponse> {
  // 1. users 테이블에서 사용자 정보 조회
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, clerk_user_id, email, subscription_tier')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('USER_NOT_FOUND');
  }

  // 2. Pro 유저인 경우 구독 정보 조회
  let subscription = undefined;
  if (user.subscription_tier === 'pro') {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, next_billing_date')
      .eq('user_id', userId)
      .in('status', ['active', 'canceled'])
      .single();

    subscription = sub
      ? {
          status: sub.status as 'active' | 'canceled' | 'expired',
          nextBillingDate: sub.next_billing_date,
        }
      : undefined;
  }

  return {
    id: user.id,
    clerkUserId: user.clerk_user_id,
    email: user.email,
    subscriptionTier: user.subscription_tier as 'free' | 'pro',
    subscription,
  };
}
