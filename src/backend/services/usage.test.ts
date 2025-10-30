import type { SupabaseClient } from '@supabase/supabase-js';
import { checkUsageLimit, consumeUsage } from './usage';

// Supabase Client를 모의(mock) 처리
const createMockSupabase = (): jest.Mocked<SupabaseClient> => {
  const mock: any = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
  };
  return mock as jest.Mocked<SupabaseClient>;
};

describe('checkUsageLimit', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    // 각 테스트는 독립적이므로, 시작 전 모든 mock을 초기화
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
  });

  test('무료 사용자가 한 번도 사용하지 않았을 경우, 남은 횟수는 1이어야 한다', async () => {
    // 1. users 테이블 조회 시 'free' 티어 반환
    (mockSupabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { subscription_tier: 'free' },
            error: null,
          }),
        };
      }
      // 2. analyses 테이블 count 조회 시 0 반환
      if (tableName === 'analyses') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            count: 0,
            error: null,
          }),
        };
      }
      return mockSupabase;
    });

    const usage = await checkUsageLimit(mockSupabase, 'user-free-tier');

    expect(usage.subscriptionTier).toBe('free');
    expect(usage.limit).toBe(1);
    expect(usage.used).toBe(0);
    expect(usage.remaining).toBe(1);
  });

  test('무료 사용자가 이미 1회 사용한 경우, 남은 횟수는 0이어야 한다', async () => {
    // 1. users 테이블 조회 시 'free' 티어 반환
    (mockSupabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { subscription_tier: 'free' },
            error: null,
          }),
        };
      }
      // 2. analyses 테이블 count 조회 시 1 반환
      if (tableName === 'analyses') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            count: 1,
            error: null,
          }),
        };
      }
      return mockSupabase;
    });

    const usage = await checkUsageLimit(mockSupabase, 'user-free-tier');

    expect(usage.subscriptionTier).toBe('free');
    expect(usage.limit).toBe(1);
    expect(usage.used).toBe(1);
    expect(usage.remaining).toBe(0);
  });

  test('Pro 사용자가 이번 달 5회 사용한 경우, 남은 횟수는 5회여야 한다', async () => {
    // 1. users 테이블 조회 시 'pro' 티어 반환
    // 2. subscriptions 테이블에서 구독 시작일 조회
    // 3. analyses 테이블에서 이번 달 사용량 5회 반환
    (mockSupabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { subscription_tier: 'pro' },
            error: null,
          }),
        };
      }
      if (tableName === 'subscriptions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { started_at: '2025-01-01T00:00:00Z' },
            error: null,
          }),
        };
      }
      if (tableName === 'analyses') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockResolvedValue({
            count: 5,
            error: null,
          }),
        };
      }
      return mockSupabase;
    });

    const usage = await checkUsageLimit(mockSupabase, 'user-pro-tier');

    expect(usage.subscriptionTier).toBe('pro');
    expect(usage.limit).toBe(10);
    expect(usage.used).toBe(5);
    expect(usage.remaining).toBe(5);
    expect(usage.nextResetDate).toBeDefined();
  });

  test('Pro 사용자가 이번 달 10회 모두 사용한 경우, 남은 횟수는 0이어야 한다', async () => {
    (mockSupabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { subscription_tier: 'pro' },
            error: null,
          }),
        };
      }
      if (tableName === 'subscriptions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { started_at: '2025-01-01T00:00:00Z' },
            error: null,
          }),
        };
      }
      if (tableName === 'analyses') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockResolvedValue({
            count: 10,
            error: null,
          }),
        };
      }
      return mockSupabase;
    });

    const usage = await checkUsageLimit(mockSupabase, 'user-pro-tier');

    expect(usage.subscriptionTier).toBe('pro');
    expect(usage.limit).toBe(10);
    expect(usage.used).toBe(10);
    expect(usage.remaining).toBe(0);
  });

  test('사용자를 찾을 수 없는 경우 에러를 throw해야 한다', async () => {
    (mockSupabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'User not found' },
          }),
        };
      }
      return mockSupabase;
    });

    await expect(checkUsageLimit(mockSupabase, 'non-existent-user')).rejects.toThrow(
      'User not found'
    );
  });

  test('Pro 사용자의 구독 정보를 찾을 수 없는 경우 에러를 throw해야 한다', async () => {
    (mockSupabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { subscription_tier: 'pro' },
            error: null,
          }),
        };
      }
      if (tableName === 'subscriptions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Subscription not found' },
          }),
        };
      }
      return mockSupabase;
    });

    await expect(checkUsageLimit(mockSupabase, 'user-without-subscription')).rejects.toThrow(
      'Subscription not found'
    );
  });

  test('무료 사용자의 사용량 조회 실패 시 에러를 throw해야 한다', async () => {
    (mockSupabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { subscription_tier: 'free' },
            error: null,
          }),
        };
      }
      if (tableName === 'analyses') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            count: null,
            error: { message: 'Database error' },
          }),
        };
      }
      return mockSupabase;
    });

    await expect(checkUsageLimit(mockSupabase, 'user-free-tier')).rejects.toThrow(
      'Failed to check usage'
    );
  });

  test('Pro 사용자의 사용량 조회 실패 시 에러를 throw해야 한다', async () => {
    (mockSupabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { subscription_tier: 'pro' },
            error: null,
          }),
        };
      }
      if (tableName === 'subscriptions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { started_at: '2025-01-01T00:00:00Z' },
            error: null,
          }),
        };
      }
      if (tableName === 'analyses') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lt: jest.fn().mockResolvedValue({
            count: null,
            error: { message: 'Database error' },
          }),
        };
      }
      return mockSupabase;
    });

    await expect(checkUsageLimit(mockSupabase, 'user-pro-tier')).rejects.toThrow(
      'Failed to check usage'
    );
  });
});

describe('consumeUsage', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
  });

  test('사용 가능한 횟수가 남아있으면 에러 없이 완료되어야 한다', async () => {
    // 무료 유저, 아직 사용하지 않음 (remaining = 1)
    (mockSupabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { subscription_tier: 'free' },
            error: null,
          }),
        };
      }
      if (tableName === 'analyses') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            count: 0,
            error: null,
          }),
        };
      }
      return mockSupabase;
    });

    await expect(consumeUsage(mockSupabase, 'user-free-tier')).resolves.not.toThrow();
  });

  test('사용 가능한 횟수가 0이면 USAGE_LIMIT_EXCEEDED 에러를 throw해야 한다', async () => {
    // 무료 유저, 이미 1회 사용 (remaining = 0)
    (mockSupabase.from as jest.Mock).mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { subscription_tier: 'free' },
            error: null,
          }),
        };
      }
      if (tableName === 'analyses') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            count: 1,
            error: null,
          }),
        };
      }
      return mockSupabase;
    });

    await expect(consumeUsage(mockSupabase, 'user-free-tier')).rejects.toThrow(
      'USAGE_LIMIT_EXCEEDED'
    );
  });
});
