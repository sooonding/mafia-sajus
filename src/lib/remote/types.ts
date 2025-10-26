/**
 * API 응답 타입 정의
 *
 * 백엔드 응답과 일치하는 타입을 제공합니다.
 */

export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * 타입 가드: 에러 응답인지 확인
 */
export function isApiError(response: unknown): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as ApiErrorResponse).error?.code === 'string'
  );
}

/**
 * API 에러에서 메시지 추출
 */
export function extractApiErrorMessage(
  error: unknown,
  defaultMessage = '오류가 발생했습니다'
): string {
  if (isApiError(error)) {
    return error.error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return defaultMessage;
}
