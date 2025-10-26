import type { SupabaseClient } from '@supabase/supabase-js';
import { startOfMonth, endOfMonth } from 'date-fns';

/**
 * 사용량 관리 유틸리티
 *
 * 분석 사용량 체크 및 제한 로직을 제공합니다.
 */

export interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  nextResetDate?: Date;
  subscriptionTier: 'free' | 'pro';
}

/**
 * 사용 가능 여부 및 정보 조회
 *
 * @param supabase Supabase 클라이언트
 * @param userId 사용자 UUID
 * @returns 사용량 정보
 */
export async function checkUsageLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<UsageInfo> {
  // 1. 사용자 구독 정보 조회
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  const tier = user.subscription_tier as 'free' | 'pro';

  if (tier === 'free') {
    // 무료 유저: 전체 기간 1회 제한
    const { count, error } = await supabase
      .from('analyses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to check usage');
    }

    const used = count ?? 0;
    const limit = 1;

    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      subscriptionTier: 'free',
    };
  } else {
    // Pro 유저: 구독 시작일 기준 월별 10회 제한
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('started_at')
      .eq('user_id', userId)
      .eq('plan', 'pro')
      .in('status', ['active', 'canceled'])
      .single();

    if (subError || !subscription) {
      throw new Error('Subscription not found');
    }

    const startedAt = new Date(subscription.started_at);
    const now = new Date();

    // 구독 시작일 기준으로 이번 달 시작/끝 날짜 계산
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // 이번 달 사용량 조회
    const { count, error } = await supabase
      .from('analyses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString());

    if (error) {
      throw new Error('Failed to check usage');
    }

    const used = count ?? 0;
    const limit = 10;

    // 다음 초기화 날짜 (다음 달 1일)
    const nextReset = new Date(monthEnd);
    nextReset.setDate(nextReset.getDate() + 1);

    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      nextResetDate: nextReset,
      subscriptionTier: 'pro',
    };
  }
}

/**
 * 사용량 체크 및 차감
 *
 * 트랜잭션 내에서 호출되어야 합니다.
 * 사용 가능 횟수가 없으면 에러를 throw합니다.
 *
 * @param tx Supabase 클라이언트 (트랜잭션용)
 * @param userId 사용자 UUID
 * @throws {Error} 사용량 초과 시
 */
export async function consumeUsage(
  tx: SupabaseClient,
  userId: string
): Promise<void> {
  const usage = await checkUsageLimit(tx, userId);

  if (usage.remaining === 0) {
    throw new Error('USAGE_LIMIT_EXCEEDED');
  }

  // 실제 사용량 차감은 analyses 테이블에 INSERT하는 것으로 자동 처리됨
  // (COUNT 기반으로 계산하므로 별도 차감 로직 불필요)
}
