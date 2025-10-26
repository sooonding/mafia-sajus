import { Hono } from 'hono';
import { requireAuth } from '@/backend/middleware/auth';
import { respond, success, failure } from '@/backend/http/response';
import { getCurrentUser } from './service';
import { CommonErrorCode } from '@/backend/errors/codes';
import type { AppEnv } from '@/backend/hono/context';

export const authRouter = new Hono<AppEnv>();

/**
 * GET /api/me
 *
 * 현재 로그인한 사용자 정보 조회
 */
authRouter.get('/me', requireAuth(), async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = c.get('supabase');

    if (!userId) {
      return respond(
        c,
        failure(401, CommonErrorCode.UNAUTHORIZED, '로그인이 필요합니다')
      );
    }

    const user = await getCurrentUser(supabase, userId);

    return respond(c, success(user));
  } catch (error) {
    const logger = c.get('logger');
    logger.error('Failed to get current user', error);

    const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';

    if (message === 'USER_NOT_FOUND') {
      return respond(
        c,
        failure(404, CommonErrorCode.NOT_FOUND, '사용자 정보를 찾을 수 없습니다')
      );
    }

    return respond(
      c,
      failure(500, CommonErrorCode.INTERNAL_ERROR, '사용자 정보를 불러올 수 없습니다')
    );
  }
});
