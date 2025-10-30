import type { Hono } from 'hono';
import type { AppEnv } from '@/backend/hono/context';
import { requireAuth } from '@/backend/middleware/auth';
import { createProSubscription } from './service';

/**
 * Toss Payments 빌링 인증 콜백 라우트
 */
export const registerBillingCallbackRoutes = (app: Hono<AppEnv>) => {
  /**
   * 결제 성공 콜백
   * Toss Payments에서 빌링 인증 성공 시 리다이렉트
   */
  app.get('/api/billing/success', requireAuth(), async (c) => {
    const userId = c.get('userId')!;
    const supabase = c.get('supabase');
    const config = c.get('config');

    // 쿼리 파라미터에서 authKey, customerKey 추출
    const authKey = c.req.query('authKey');
    const customerKey = c.req.query('customerKey');

    // 필수 파라미터 검증
    if (!authKey || !customerKey) {
      return c.redirect(
        `/subscription?status=error&message=${encodeURIComponent('인증 정보가 누락되었습니다')}`
      );
    }

    // 보안 검증: customerKey가 현재 로그인한 사용자와 일치하는지 확인
    if (customerKey !== userId) {
      return c.redirect(
        `/subscription?status=error&message=${encodeURIComponent('인증 정보가 일치하지 않습니다')}`
      );
    }

    try {
      // 빌링키 발급 및 구독 생성
      await createProSubscription(
        supabase,
        userId,
        authKey,
        config.toss.secretKey
      );

      // 성공 시 구독 페이지로 리다이렉트
      return c.redirect('/subscription?status=success');
    } catch (error: any) {
      const errorMessage = error.message || '구독 처리 중 오류가 발생했습니다';
      return c.redirect(
        `/subscription?status=error&message=${encodeURIComponent(errorMessage)}`
      );
    }
  });

  /**
   * 결제 실패 콜백
   * Toss Payments에서 빌링 인증 실패 시 리다이렉트
   */
  app.get('/api/billing/fail', async (c) => {
    // Toss Payments에서 전달하는 에러 정보
    const code = c.req.query('code');
    const message = c.req.query('message');

    const errorMessage = message || '결제 인증에 실패했습니다';

    return c.redirect(
      `/subscription?status=fail&message=${encodeURIComponent(errorMessage)}`
    );
  });
};
