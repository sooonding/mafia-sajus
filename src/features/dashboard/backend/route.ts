import { Hono } from 'hono';
import { requireAuth } from '@/backend/middleware/auth';
import { respond, success, failure } from '@/backend/http/response';
import { checkUsageLimit } from '@/backend/services/usage';
import { CommonErrorCode } from '@/backend/errors/codes';
import type { AppEnv } from '@/backend/hono/context';

export const dashboardRouter = new Hono<AppEnv>();

/**
 * GET /api/me/usage
 *
 * 현재 사용자의 사용량 정보 조회
 */
dashboardRouter.get('/me/usage', requireAuth(), async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = c.get('supabase');

    if (!userId) {
      return respond(
        c,
        failure(401, CommonErrorCode.UNAUTHORIZED, '로그인이 필요합니다')
      );
    }

    const usageInfo = await checkUsageLimit(supabase, userId);

    // Date를 ISO string으로 변환
    const response = {
      ...usageInfo,
      nextResetDate: usageInfo.nextResetDate?.toISOString(),
    };

    return respond(c, success(response));
  } catch (error) {
    const logger = c.get('logger');
    logger.error('Failed to get usage info', error);

    return respond(
      c,
      failure(500, CommonErrorCode.INTERNAL_ERROR, '사용량 정보를 불러올 수 없습니다')
    );
  }
});
