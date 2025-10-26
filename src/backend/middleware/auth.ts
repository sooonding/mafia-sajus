import type { MiddlewareHandler } from 'hono';
import { verifyToken } from '@clerk/backend';
import type { AppEnv } from '@/backend/hono/context';
import { CommonErrorCode } from '@/backend/errors/codes';
import { failure } from '@/backend/http/response';

/**
 * Clerk 인증 미들웨어
 *
 * Authorization 헤더에서 Bearer 토큰을 추출하고 검증합니다.
 * 검증 성공 시 clerkUserId와 userId(DB UUID)를 컨텍스트에 주입합니다.
 */

/**
 * 필수 인증 미들웨어
 *
 * 인증되지 않은 경우 401 에러를 반환합니다.
 *
 * @example
 * ```ts
 * app.get('/api/protected', requireAuth(), async (c) => {
 *   const userId = c.get('userId'); // 자동 주입됨
 *   // ...
 * });
 * ```
 */
export const requireAuth = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const logger = c.get('logger');
    const supabase = c.get('supabase');
    const config = c.get('config');

    // Authorization 헤더에서 토큰 추출
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid Authorization header');
      return c.json(
        failure(401, CommonErrorCode.UNAUTHORIZED, '로그인이 필요합니다'),
        401
      );
    }

    const token = authHeader.substring(7);

    try {
      // Clerk 토큰 검증
      const payload = await verifyToken(token, {
        secretKey: config.clerk.secretKey,
      });

      const clerkUserId = payload.sub;

      if (!clerkUserId) {
        logger.warn('Invalid token: missing sub claim');
        return c.json(
          failure(401, CommonErrorCode.UNAUTHORIZED, '유효하지 않은 토큰입니다'),
          401
        );
      }

      // DB에서 사용자 조회
      let { data: user, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('clerk_user_id', clerkUserId)
        .single();

      // 사용자가 없으면 자동 생성 (Clerk에서 이메일 가져오기)
      if (error || !user) {
        logger.info('User not found, creating new user', { clerkUserId });

        try {
          // Clerk API를 통해 사용자 정보 가져오기
          const clerkUser = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
            headers: {
              Authorization: `Bearer ${config.clerk.secretKey}`,
            },
          }).then(res => res.json());

          const email = clerkUser.email_addresses?.[0]?.email_address || `${clerkUserId}@clerk.user`;

          // 새 사용자 생성
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              clerk_user_id: clerkUserId,
              email,
              subscription_tier: 'free',
            })
            .select('id')
            .single();

          if (createError || !newUser) {
            logger.error('Failed to create user', { clerkUserId, createError });
            return c.json(
              failure(500, CommonErrorCode.INTERNAL_ERROR, '사용자 생성에 실패했습니다'),
              500
            );
          }

          user = newUser;
          logger.info('User created successfully', { clerkUserId, userId: user.id });
        } catch (createError) {
          logger.error('Failed to create user', { clerkUserId, createError });
          return c.json(
            failure(500, CommonErrorCode.INTERNAL_ERROR, '사용자 생성에 실패했습니다'),
            500
          );
        }
      }

      // 컨텍스트에 사용자 정보 주입
      c.set('clerkUserId', clerkUserId);
      c.set('userId', user.id);

      await next();
    } catch (error) {
      logger.error('Authentication failed', error);
      return c.json(
        failure(
          401,
          CommonErrorCode.SESSION_EXPIRED,
          '세션이 만료되었습니다. 다시 로그인해주세요'
        ),
        401
      );
    }
  };
};

/**
 * 선택적 인증 미들웨어
 *
 * 토큰이 있으면 검증하고, 없어도 요청을 통과시킵니다.
 * 공개 엔드포인트에서 사용자 정보가 있을 때만 추가 기능을 제공하는 경우 유용합니다.
 *
 * @example
 * ```ts
 * app.get('/api/public', optionalAuth(), async (c) => {
 *   const userId = c.get('userId'); // 있을 수도, 없을 수도 있음
 *   if (userId) {
 *     // 인증된 사용자 로직
 *   } else {
 *     // 비인증 사용자 로직
 *   }
 * });
 * ```
 */
export const optionalAuth = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const logger = c.get('logger');
    const supabase = c.get('supabase');
    const config = c.get('config');

    const authHeader = c.req.header('Authorization');

    // 토큰이 없으면 그냥 통과
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await next();
      return;
    }

    const token = authHeader.substring(7);

    try {
      // Clerk 토큰 검증
      const payload = await verifyToken(token, {
        secretKey: config.clerk.secretKey,
      });

      const clerkUserId = payload.sub;

      if (clerkUserId) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('clerk_user_id', clerkUserId)
          .single();

        if (user) {
          c.set('clerkUserId', clerkUserId);
          c.set('userId', user.id);
        }
      }

      await next();
    } catch (error) {
      logger.warn('Optional auth failed, continuing as unauthenticated', error);
      await next();
    }
  };
};
