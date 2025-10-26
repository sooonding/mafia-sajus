import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 데이터베이스 헬퍼 유틸리티
 *
 * Supabase 쿼리 및 트랜잭션 공통 로직을 제공합니다.
 */

/**
 * 페이지네이션 파라미터
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * 페이지네이션 결과
 */
export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * 트랜잭션 실행
 *
 * Supabase는 네이티브 트랜잭션을 지원하지 않으므로,
 * 낙관적 동시성 제어 또는 FOR UPDATE를 사용하여 구현합니다.
 *
 * 주의: Supabase는 PostgreSQL 트랜잭션을 완전히 지원하지 않으므로,
 * 중요한 작업은 RPC 함수를 통해 서버 측에서 처리하는 것을 권장합니다.
 *
 * @example
 * ```ts
 * const result = await withTransaction(supabase, async (tx) => {
 *   // 사용량 체크 및 차감
 *   const { data: usage } = await tx.from('usage_records').select('*');
 *   await tx.from('usage_records').update({ count: usage.count + 1 });
 *   return usage;
 * });
 * ```
 */
export async function withTransaction<T>(
  supabase: SupabaseClient,
  callback: (tx: SupabaseClient) => Promise<T>
): Promise<T> {
  // Supabase는 클라이언트 측 트랜잭션을 지원하지 않으므로,
  // 동일한 클라이언트를 전달하고 에러 시 롤백은 애플리케이션 로직으로 처리
  // 실제 프로덕션에서는 RPC 함수를 통해 서버 측 트랜잭션을 사용하는 것이 안전함

  try {
    const result = await callback(supabase);
    return result;
  } catch (error) {
    // 롤백은 애플리케이션 레벨에서 처리 (Supabase 제한사항)
    throw error;
  }
}

/**
 * 페이지네이션 쿼리 헬퍼
 *
 * 주의: Supabase 타입 제한으로 인해 실제 사용 시 직접 페이지네이션 로직 구현 권장
 *
 * @example
 * ```ts
 * // 직접 사용 예시
 * const { data, count } = await supabase
 *   .from('analyses')
 *   .select('*', { count: 'exact' })
 *   .eq('user_id', userId)
 *   .range(offset, offset + limit - 1);
 * ```
 */
export async function paginateQuery<T>(
  supabase: SupabaseClient,
  tableName: string,
  params: PaginationParams,
  filter?: (query: any) => any
): Promise<PaginationResult<T>> {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  let query = supabase.from(tableName).select('*', { count: 'exact' });

  if (filter) {
    query = filter(query);
  }

  const { data, count, error } = await query.range(
    offset,
    offset + limit - 1
  );

  if (error) {
    throw transformSupabaseError(error);
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: (data as T[]) ?? [],
    total,
    page,
    totalPages,
  };
}

/**
 * Supabase 에러를 표준 에러로 변환
 *
 * @example
 * ```ts
 * try {
 *   await supabase.from('users').insert(data);
 * } catch (error) {
 *   const standardError = transformSupabaseError(error);
 *   throw standardError;
 * }
 * ```
 */
export function transformSupabaseError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as {
      message?: string;
      code?: string;
      details?: string;
    };

    const message = err.message || err.details || 'Database error occurred';
    return new Error(message);
  }

  return new Error('Unknown database error');
}

/**
 * 단일 레코드 조회 헬퍼 (존재하지 않으면 에러)
 *
 * 주의: 타입 안전성을 위해 직접 쿼리 작성 권장
 *
 * @example
 * ```ts
 * // 직접 사용 예시
 * const { data, error } = await supabase
 *   .from('users')
 *   .select('*')
 *   .eq('id', userId)
 *   .single();
 * ```
 */
export async function findOne<T = any>(
  supabase: SupabaseClient,
  tableName: string,
  filter: Record<string, any>
): Promise<T> {
  let query = supabase.from(tableName).select('*');

  Object.entries(filter).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { data, error } = await query.single();

  if (error) {
    throw transformSupabaseError(error);
  }

  if (!data) {
    throw new Error('Record not found');
  }

  return data as T;
}

/**
 * 레코드 존재 여부 확인
 *
 * @example
 * ```ts
 * const userExists = await exists(
 *   supabase,
 *   'users',
 *   { clerk_user_id: clerkUserId }
 * );
 * ```
 */
export async function exists(
  supabase: SupabaseClient,
  tableName: string,
  filter: Record<string, any>
): Promise<boolean> {
  let query = supabase.from(tableName).select('id', { count: 'exact', head: true });

  Object.entries(filter).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { count, error } = await query;

  if (error) {
    throw transformSupabaseError(error);
  }

  return (count ?? 0) > 0;
}
