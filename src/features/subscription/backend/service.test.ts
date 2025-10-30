import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createProSubscription,
  cancelSubscription,
  resumeSubscription,
  getSubscription,
  getUsageInfo,
  getPaymentHistories,
} from './service';
import {
  issueBillingKey,
  approveBilling,
  deleteBillingKey,
  TOSS_CONSTANTS,
} from '@/backend/integrations/tosspayments/client';
import { checkUsageLimit } from '@/backend/services/usage';
import { subscriptionErrorCodes } from './error';

// Mock 의존성
jest.mock('@/backend/integrations/tosspayments/client');
jest.mock('@/backend/services/usage');

const mockedCheckUsageLimit = checkUsageLimit as jest.MockedFunction<typeof checkUsageLimit>;

const mockedIssueBillingKey = issueBillingKey as jest.MockedFunction<typeof issueBillingKey>;
const mockedApproveBilling = approveBilling as jest.MockedFunction<typeof approveBilling>;
const mockedDeleteBillingKey = deleteBillingKey as jest.MockedFunction<typeof deleteBillingKey>;

describe('createProSubscription', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;
  const testUserId = 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d';
  const testAuthKey = 'test-auth-key';
  const testSecretKey = 'test-secret-key';
  const testBillingKey = 'billing-key-1234';
  const testPaymentKey = 'payment-key-1234';

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockImplementation(() => mockSupabase),
      in: jest.fn().mockImplementation(() => mockSupabase),
      single: jest.fn(),
    } as any;
  });

  test('Pro 구독 생성이 성공하면 모든 단계가 완료되어야 한다', async () => {
    // Arrange
    // 1. 기존 구독 없음 (getSubscription: from().select().eq().in().single())
    let eqCallCount = 0;
    (mockSupabase.eq as jest.Mock).mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount === 1) {
        // getSubscription의 .eq('user_id', userId)
        return mockSupabase;
      } else {
        // users 업데이트의 .eq('id', userId)
        return Promise.resolve({ error: null });
      }
    });

    (mockSupabase.single as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    });

    // 2. 빌링키 발급 성공
    mockedIssueBillingKey.mockResolvedValue({
      billingKey: testBillingKey,
      customerKey: testUserId,
    });

    // 3. 첫 결제 승인 성공
    const approvedAt = new Date('2025-10-29T10:00:00Z');
    mockedApproveBilling.mockResolvedValue({
      paymentKey: testPaymentKey,
      approvedAt,
    });

    // 4. subscriptions insert 성공
    // 5. payment_histories insert 성공
    (mockSupabase.insert as jest.Mock)
      .mockResolvedValueOnce({ error: null })  // subscriptions
      .mockResolvedValueOnce({ error: null }); // payment_histories

    // Act
    await createProSubscription(mockSupabase, testUserId, testAuthKey, testSecretKey);

    // Assert
    expect(mockedIssueBillingKey).toHaveBeenCalledWith(testAuthKey, testUserId, testSecretKey);
    expect(mockedApproveBilling).toHaveBeenCalledWith(
      testBillingKey,
      TOSS_CONSTANTS.PRO_PRICE,
      expect.stringContaining('order_'),
      TOSS_CONSTANTS.ORDER_NAME,
      testSecretKey
    );
    expect(mockSupabase.update).toHaveBeenCalledWith({ subscription_tier: 'pro' });
    expect(mockSupabase.insert).toHaveBeenCalledTimes(2); // subscriptions + payment_histories
  });

  test('이미 활성 구독이 있으면 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: {
        id: 'b2c3d4e5-f6a7-4b5c-8d7e-9f0a1b2c3d4e',
        user_id: testUserId,
        plan: 'pro',
        status: 'active',
        billing_key: testBillingKey,
        customer_key: testUserId,
        started_at: '2025-10-01T00:00:00Z',
        next_billing_date: '2025-11-01T00:00:00Z',
        canceled_at: null,
        created_at: '2025-10-01T00:00:00Z',
        updated_at: '2025-10-01T00:00:00Z',
      },
      error: null,
    });

    // Act & Assert
    await expect(
      createProSubscription(mockSupabase, testUserId, testAuthKey, testSecretKey)
    ).rejects.toMatchObject({
      message: '이미 활성 구독이 있습니다',
      code: subscriptionErrorCodes.subscriptionAlreadyActive,
    });
  });

  test('빌링키 발급 실패 시 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    mockedIssueBillingKey.mockRejectedValue(new Error('Billing key issuance failed'));

    // Act & Assert
    await expect(
      createProSubscription(mockSupabase, testUserId, testAuthKey, testSecretKey)
    ).rejects.toMatchObject({
      message: 'Pro 구독 생성에 실패했습니다',
      code: subscriptionErrorCodes.billingKeyIssueFailed,
    });
  });

  test('첫 결제 실패 시 빌링키를 삭제하고 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    mockedIssueBillingKey.mockResolvedValue({
      billingKey: testBillingKey,
      customerKey: testUserId,
    });

    mockedApproveBilling.mockRejectedValue(new Error('Payment approval failed'));
    mockedDeleteBillingKey.mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      createProSubscription(mockSupabase, testUserId, testAuthKey, testSecretKey)
    ).rejects.toThrow('Pro 구독 생성에 실패했습니다');

    expect(mockedDeleteBillingKey).toHaveBeenCalledWith(testBillingKey, testSecretKey);
  });

  test('users 업데이트 실패 시 빌링키를 삭제하고 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    mockedIssueBillingKey.mockResolvedValue({
      billingKey: testBillingKey,
      customerKey: testUserId,
    });

    mockedApproveBilling.mockResolvedValue({
      paymentKey: testPaymentKey,
      approvedAt: new Date('2025-10-29T10:00:00Z'),
    });

    (mockSupabase.update as jest.Mock).mockResolvedValue({
      error: { message: 'Update failed' },
    });

    mockedDeleteBillingKey.mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      createProSubscription(mockSupabase, testUserId, testAuthKey, testSecretKey)
    ).rejects.toThrow();

    expect(mockedDeleteBillingKey).toHaveBeenCalledWith(testBillingKey, testSecretKey);
  });

  test('subscriptions insert 실패 시 빌링키를 삭제하고 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    mockedIssueBillingKey.mockResolvedValue({
      billingKey: testBillingKey,
      customerKey: testUserId,
    });

    mockedApproveBilling.mockResolvedValue({
      paymentKey: testPaymentKey,
      approvedAt: new Date('2025-10-29T10:00:00Z'),
    });

    let insertCallCount = 0;
    (mockSupabase.update as jest.Mock).mockResolvedValue({ error: null });
    (mockSupabase.insert as jest.Mock).mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        // subscriptions insert 실패
        return Promise.resolve({ error: { message: 'Insert failed' } });
      }
      return Promise.resolve({ error: null });
    });

    mockedDeleteBillingKey.mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      createProSubscription(mockSupabase, testUserId, testAuthKey, testSecretKey)
    ).rejects.toThrow();

    expect(mockedDeleteBillingKey).toHaveBeenCalledWith(testBillingKey, testSecretKey);
  });

  test('payment_histories insert 실패 시 빌링키를 삭제하고 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    mockedIssueBillingKey.mockResolvedValue({
      billingKey: testBillingKey,
      customerKey: testUserId,
    });

    mockedApproveBilling.mockResolvedValue({
      paymentKey: testPaymentKey,
      approvedAt: new Date('2025-10-29T10:00:00Z'),
    });

    let insertCallCount = 0;
    (mockSupabase.update as jest.Mock).mockResolvedValue({ error: null });
    (mockSupabase.insert as jest.Mock).mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        // subscriptions insert 성공
        return Promise.resolve({ error: null });
      } else {
        // payment_histories insert 실패
        return Promise.resolve({ error: { message: 'Payment history insert failed' } });
      }
    });

    mockedDeleteBillingKey.mockResolvedValue(undefined);

    // Act & Assert
    await expect(
      createProSubscription(mockSupabase, testUserId, testAuthKey, testSecretKey)
    ).rejects.toThrow();

    expect(mockedDeleteBillingKey).toHaveBeenCalledWith(testBillingKey, testSecretKey);
  });
});

describe('cancelSubscription', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;
  const testUserId = 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d';
  const testSubId = 'c3d4e5f6-a7b8-4c5d-8e7f-9a0b1c2d3e4f';

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockImplementation(() => mockSupabase),
      in: jest.fn().mockImplementation(() => mockSupabase),
      single: jest.fn(),
    } as any;
  });

  test('활성 구독을 취소하면 status가 canceled로 변경되어야 한다', async () => {
    // Arrange
    const nextBillingDate = '2025-11-29T00:00:00Z';

    // getSubscription 체인 Mock
    let eqCallCount = 0;
    (mockSupabase.eq as jest.Mock).mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount === 1) {
        // getSubscription의 .eq('user_id', userId)
        return mockSupabase;
      } else {
        // cancelSubscription의 .eq('id', subscription.id)
        return Promise.resolve({ error: null });
      }
    });
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: {
        id: testSubId,
        user_id: testUserId,
        plan: 'pro',
        status: 'active',
        billing_key: 'billing-key-1234',
        customer_key: testUserId,
        started_at: '2025-10-01T00:00:00Z',
        next_billing_date: nextBillingDate,
        canceled_at: null,
        created_at: '2025-10-01T00:00:00Z',
        updated_at: '2025-10-01T00:00:00Z',
      },
      error: null,
    });

    // Act
    const result = await cancelSubscription(mockSupabase, testUserId);

    // Assert
    expect(mockSupabase.update).toHaveBeenCalledWith({
      status: 'canceled',
      canceled_at: expect.any(String),
    });
    expect(result.nextBillingDate).toEqual(new Date(nextBillingDate));
  });

  test('구독이 없으면 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    // Act & Assert
    await expect(cancelSubscription(mockSupabase, testUserId)).rejects.toMatchObject({
      message: '구독 정보를 찾을 수 없습니다',
      code: subscriptionErrorCodes.subscriptionNotFound,
    });
  });

  test('활성 구독이 아니면 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: {
        id: testSubId,
        user_id: testUserId,
        plan: 'pro',
        status: 'canceled',
        billing_key: 'billing-key-1234',
        customer_key: testUserId,
        started_at: '2025-10-01T00:00:00Z',
        next_billing_date: '2025-11-01T00:00:00Z',
        canceled_at: '2025-10-15T00:00:00Z',
        created_at: '2025-10-01T00:00:00Z',
        updated_at: '2025-10-15T00:00:00Z',
      },
      error: null,
    });

    // Act & Assert
    await expect(cancelSubscription(mockSupabase, testUserId)).rejects.toMatchObject({
      message: '활성 구독이 아닙니다',
      code: subscriptionErrorCodes.subscriptionNotActive,
    });
  });

  test('취소 사유가 있는 경우 로그를 출력해야 한다', async () => {
    // Arrange
    const nextBillingDate = '2025-11-29T00:00:00Z';
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    let eqCallCount = 0;
    (mockSupabase.eq as jest.Mock).mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount === 1) {
        return mockSupabase;
      } else {
        return Promise.resolve({ error: null });
      }
    });

    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: {
        id: testSubId,
        user_id: testUserId,
        plan: 'pro',
        status: 'active',
        billing_key: 'billing-key-1234',
        customer_key: testUserId,
        started_at: '2025-10-01T00:00:00Z',
        next_billing_date: nextBillingDate,
        canceled_at: null,
        created_at: '2025-10-01T00:00:00Z',
        updated_at: '2025-10-01T00:00:00Z',
      },
      error: null,
    });

    // Act
    await cancelSubscription(mockSupabase, testUserId, '가격이 너무 비싸요');

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Subscription canceled. Reason: 가격이 너무 비싸요')
    );

    consoleSpy.mockRestore();
  });
});

describe('resumeSubscription', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;
  const testUserId = 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d';
  const testSubId = 'c3d4e5f6-a7b8-4c5d-8e7f-9a0b1c2d3e4f';

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockImplementation(() => mockSupabase),
      in: jest.fn().mockImplementation(() => mockSupabase),
      single: jest.fn(),
    } as any;
  });

  test('취소된 구독을 재개하면 status가 active로 변경되어야 한다', async () => {
    // Arrange
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const nextBillingDate = futureDate.toISOString();

    // getSubscription 체인 Mock
    let eqCallCount = 0;
    (mockSupabase.eq as jest.Mock).mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount === 1) {
        // getSubscription의 .eq('user_id', userId)
        return mockSupabase;
      } else {
        // resumeSubscription의 .eq('id', subscription.id)
        return Promise.resolve({ error: null });
      }
    });
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: {
        id: testSubId,
        user_id: testUserId,
        plan: 'pro',
        status: 'canceled',
        billing_key: 'billing-key-1234',
        customer_key: testUserId,
        started_at: '2025-10-01T00:00:00Z',
        next_billing_date: nextBillingDate,
        canceled_at: '2025-10-15T00:00:00Z',
        created_at: '2025-10-01T00:00:00Z',
        updated_at: '2025-10-15T00:00:00Z',
      },
      error: null,
    });

    // Act
    const result = await resumeSubscription(mockSupabase, testUserId);

    // Assert
    expect(mockSupabase.update).toHaveBeenCalledWith({
      status: 'active',
      canceled_at: null,
    });
    expect(result.nextBillingDate).toEqual(new Date(nextBillingDate));
  });

  test('구독이 없으면 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    // Act & Assert
    await expect(resumeSubscription(mockSupabase, testUserId)).rejects.toMatchObject({
      message: '구독 정보를 찾을 수 없습니다',
      code: subscriptionErrorCodes.subscriptionNotFound,
    });
  });

  test('취소된 구독이 아니면 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: {
        id: testSubId,
        user_id: testUserId,
        plan: 'pro',
        status: 'active',
        billing_key: 'billing-key-1234',
        customer_key: testUserId,
        started_at: '2025-10-01T00:00:00Z',
        next_billing_date: '2025-11-01T00:00:00Z',
        canceled_at: null,
        created_at: '2025-10-01T00:00:00Z',
        updated_at: '2025-10-01T00:00:00Z',
      },
      error: null,
    });

    // Act & Assert
    await expect(resumeSubscription(mockSupabase, testUserId)).rejects.toMatchObject({
      message: '취소된 구독이 아닙니다',
      code: subscriptionErrorCodes.subscriptionAlreadyActive,
    });
  });

  test('구독이 만료되었으면 에러를 throw해야 한다', async () => {
    // Arrange
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const nextBillingDate = pastDate.toISOString();

    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: {
        id: testSubId,
        user_id: testUserId,
        plan: 'pro',
        status: 'canceled',
        billing_key: 'billing-key-1234',
        customer_key: testUserId,
        started_at: '2025-10-01T00:00:00Z',
        next_billing_date: nextBillingDate,
        canceled_at: '2025-10-15T00:00:00Z',
        created_at: '2025-10-01T00:00:00Z',
        updated_at: '2025-10-15T00:00:00Z',
      },
      error: null,
    });

    // Act & Assert
    await expect(resumeSubscription(mockSupabase, testUserId)).rejects.toMatchObject({
      message: '구독이 이미 만료되었습니다',
      code: subscriptionErrorCodes.subscriptionExpired,
    });
  });
});

describe('getSubscription', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;
  const testUserId = 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d';

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn(),
    } as any;
  });

  test('활성 구독을 성공적으로 조회해야 한다', async () => {
    // Arrange
    const testSubId = 'd4e5f6a7-b8c9-4d5e-8f7a-9b0c1d2e3f4a';
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: {
        id: testSubId,
        user_id: testUserId,
        plan: 'pro',
        status: 'active',
        billing_key: 'billing-key-1234',
        customer_key: testUserId,
        started_at: '2025-10-01T00:00:00Z',
        next_billing_date: '2025-11-01T00:00:00Z',
        canceled_at: null,
        created_at: '2025-10-01T00:00:00Z',
        updated_at: '2025-10-01T00:00:00Z',
      },
      error: null,
    });

    // Act
    const result = await getSubscription(mockSupabase, testUserId);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.id).toBe(testSubId);
    expect(result?.plan).toBe('pro');
    expect(result?.status).toBe('active');
    expect(result?.billingKey).toBe('billing-key-1234');
  });

  test('구독이 없으면 null을 반환해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    // Act
    const result = await getSubscription(mockSupabase, testUserId);

    // Assert
    expect(result).toBeNull();
  });
});

describe('getUsageInfo', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;
  const testUserId = 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d';

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {} as any;
  });

  test('사용량 정보를 성공적으로 조회해야 한다', async () => {
    // Arrange
    const nextResetDate = new Date('2025-11-01T00:00:00Z');
    mockedCheckUsageLimit.mockResolvedValue({
      subscriptionTier: 'pro',
      used: 5,
      limit: 10,
      remaining: 5,
      nextResetDate,
    });

    // Act
    const result = await getUsageInfo(mockSupabase, testUserId);

    // Assert
    expect(result.used).toBe(5);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(5);
    expect(result.nextResetDate).toBe(nextResetDate.toISOString());
  });

  test('무료 사용자의 사용량 정보를 조회해야 한다', async () => {
    // Arrange
    mockedCheckUsageLimit.mockResolvedValue({
      subscriptionTier: 'free',
      used: 1,
      limit: 1,
      remaining: 0,
    });

    // Act
    const result = await getUsageInfo(mockSupabase, testUserId);

    // Assert
    expect(result.used).toBe(1);
    expect(result.limit).toBe(1);
    expect(result.remaining).toBe(0);
    expect(result.nextResetDate).toBeUndefined();
  });
});

describe('getPaymentHistories', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;
  const testUserId = 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d';

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn(),
    } as any;
  });

  test('결제 이력을 페이지네이션과 함께 조회해야 한다', async () => {
    // Arrange
    const payment1Id = 'e5f6a7b8-c9d0-4e5f-8a7b-9c0d1e2f3a4b';
    const payment2Id = 'f6a7b8c9-d0e1-4f5a-8b7c-9d0e1f2a3b4c';
    const mockPayments = [
      {
        id: payment1Id,
        user_id: testUserId,
        payment_key: 'payment-key-1',
        order_id: 'order-1',
        amount: 9900,
        status: 'DONE',
        paid_at: '2025-10-29T10:00:00Z',
        created_at: '2025-10-29T10:00:00Z',
        updated_at: '2025-10-29T10:00:00Z',
      },
      {
        id: payment2Id,
        user_id: testUserId,
        payment_key: 'payment-key-2',
        order_id: 'order-2',
        amount: 9900,
        status: 'DONE',
        paid_at: '2025-09-29T10:00:00Z',
        created_at: '2025-09-29T10:00:00Z',
        updated_at: '2025-09-29T10:00:00Z',
      },
    ];

    (mockSupabase.range as jest.Mock).mockResolvedValue({
      data: mockPayments,
      error: null,
    });

    // Act
    const result = await getPaymentHistories(mockSupabase, testUserId, 1, 10);

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(payment1Id);
    expect(result[0].paymentKey).toBe('payment-key-1');
    expect(result[1].id).toBe(payment2Id);
    expect(mockSupabase.order).toHaveBeenCalledWith('paid_at', { ascending: false });
  });

  test('결제 이력이 없으면 빈 배열을 반환해야 한다', async () => {
    // Arrange
    (mockSupabase.range as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    // Act
    const result = await getPaymentHistories(mockSupabase, testUserId, 1, 10);

    // Assert
    expect(result).toEqual([]);
  });

  test('데이터가 빈 배열이어도 정상 처리되어야 한다', async () => {
    // Arrange
    (mockSupabase.range as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    });

    // Act
    const result = await getPaymentHistories(mockSupabase, testUserId, 1, 10);

    // Assert
    expect(result).toEqual([]);
  });
});
