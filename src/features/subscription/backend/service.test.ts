import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createProSubscription,
  cancelSubscription,
  resumeSubscription,
  getSubscription,
} from './service';
import {
  issueBillingKey,
  approveBilling,
  deleteBillingKey,
  TOSS_CONSTANTS,
} from '@/backend/integrations/tosspayments/client';
import { subscriptionErrorCodes } from './error';

// Mock 의존성
jest.mock('@/backend/integrations/tosspayments/client');
jest.mock('@/backend/services/usage');

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
