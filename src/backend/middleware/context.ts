import { createMiddleware } from 'hono/factory';
import { getAppConfig } from '@/backend/config';
import {
  contextKeys,
  type AppEnv,
  type AppLogger,
} from '@/backend/hono/context';

const logger: AppLogger = {
  info: (...args) => console.info(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  debug: (...args) => console.debug(...args),
};

export const withAppContext = () => {
  return createMiddleware<AppEnv>(async (c, next) => {
    // 런타임에만 config를 가져옴 (빌드 타임이 아닌)
    const config = getAppConfig();

    c.set(contextKeys.logger, logger);
    c.set(contextKeys.config, config);

    await next();
  });
};
