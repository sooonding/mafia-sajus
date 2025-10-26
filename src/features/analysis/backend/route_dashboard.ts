import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '@/backend/middleware/auth';
import { respond, success, failure } from '@/backend/http/response';
import { getAnalysisHistory, getAnalysisById } from './service';
import { CommonErrorCode } from '@/backend/errors/codes';
import type { AppEnv } from '@/backend/hono/context';

export const analysisDashboardRouter = new Hono<AppEnv>();

const querySchema = z.object({
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1))
    .default('1'),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(20))
    .default('10'),
});

analysisDashboardRouter.get('/analyses-list', requireAuth(), zValidator('query', querySchema), async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = c.get('supabase');

    if (!userId) {
      return respond(
        c,
        failure(401, CommonErrorCode.UNAUTHORIZED, '로그인이 필요합니다')
      );
    }

    const { page, limit } = c.req.valid('query');

    const history = await getAnalysisHistory(supabase, userId, page, limit);

    return respond(c, success(history));
  } catch (error) {
    const logger = c.get('logger');
    logger.error('Failed to get analysis history', error);

    return respond(
      c,
      failure(500, CommonErrorCode.INTERNAL_ERROR, '분석 이력을 불러올 수 없습니다')
    );
  }
});

analysisDashboardRouter.get('/analyses-detail/:id', requireAuth(), async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = c.get('supabase');

    if (!userId) {
      return respond(
        c,
        failure(401, CommonErrorCode.UNAUTHORIZED, '로그인이 필요합니다')
      );
    }

    const analysisId = c.req.param('id');

    const analysis = await getAnalysisById(supabase, userId, analysisId);

    return respond(c, success(analysis));
  } catch (error) {
    const logger = c.get('logger');
    logger.error('Failed to get analysis', error);

    const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';

    if (message === 'ANALYSIS_NOT_FOUND') {
      return respond(
        c,
        failure(404, CommonErrorCode.NOT_FOUND, '분석 결과를 찾을 수 없습니다')
      );
    }

    if (message === 'ANALYSIS_FORBIDDEN') {
      return respond(
        c,
        failure(403, CommonErrorCode.FORBIDDEN, '접근 권한이 없습니다')
      );
    }

    return respond(
      c,
      failure(500, CommonErrorCode.INTERNAL_ERROR, '분석 결과를 불러올 수 없습니다')
    );
  }
});
