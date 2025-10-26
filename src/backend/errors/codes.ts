/**
 * 공통 에러 코드 정의
 *
 * 전체 애플리케이션에서 사용할 표준 에러 코드를 정의합니다.
 * Feature별로 고유한 에러 코드가 필요한 경우 해당 feature의 backend/error.ts에 정의하세요.
 */

export const CommonErrorCode = {
  // 인증 (4xx)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // 검증 (4xx)
  INVALID_INPUT: 'INVALID_INPUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // 리소스 (4xx)
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // 서버 (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
} as const;

export type CommonErrorCode =
  (typeof CommonErrorCode)[keyof typeof CommonErrorCode];

/**
 * 에러 코드와 HTTP 상태 코드 매핑
 */
export const ErrorCodeToHttpStatus: Record<CommonErrorCode, number> = {
  [CommonErrorCode.UNAUTHORIZED]: 401,
  [CommonErrorCode.FORBIDDEN]: 403,
  [CommonErrorCode.SESSION_EXPIRED]: 401,
  [CommonErrorCode.INVALID_INPUT]: 400,
  [CommonErrorCode.VALIDATION_ERROR]: 400,
  [CommonErrorCode.NOT_FOUND]: 404,
  [CommonErrorCode.CONFLICT]: 409,
  [CommonErrorCode.INTERNAL_ERROR]: 500,
  [CommonErrorCode.DATABASE_ERROR]: 500,
  [CommonErrorCode.EXTERNAL_API_ERROR]: 502,
};
