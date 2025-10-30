import axios from 'axios';
import {
  issueBillingKey,
  approveBilling,
  deleteBillingKey,
  verifyWebhookSignature,
  TOSS_CONSTANTS,
} from './client';

// axios Mock
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('토스페이먼츠 클라이언트', () => {
  const testSecretKey = 'test_sk_1234567890';
  const testAuthKey = 'test_auth_key';
  const testCustomerKey = 'user-uuid-1234';
  const testBillingKey = 'billing_key_1234';
  const testPaymentKey = 'payment_key_1234';
  const testOrderId = 'ORDER_1234567890';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('issueBillingKey', () => {
    test('빌링키 발급이 성공하면 billingKey와 customerKey를 반환해야 한다', async () => {
      // Arrange
      const mockResponse = {
        data: {
          billingKey: testBillingKey,
          customerKey: testCustomerKey,
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await issueBillingKey(testAuthKey, testCustomerKey, testSecretKey);

      // Assert
      expect(result).toEqual({
        billingKey: testBillingKey,
        customerKey: testCustomerKey,
      });
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/billing/authorizations/issue'),
        {
          authKey: testAuthKey,
          customerKey: testCustomerKey,
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic'),
          }),
        })
      );
    });

    test('API 에러가 발생하면 에러 메시지와 함께 throw해야 한다', async () => {
      // Arrange
      const errorMessage = 'Invalid authKey';
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          data: {
            message: errorMessage,
          },
        },
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      // Act & Assert
      await expect(issueBillingKey(testAuthKey, testCustomerKey, testSecretKey)).rejects.toThrow(
        `Billing key issuance failed: ${errorMessage}`
      );
    });

    test('일반 에러가 발생하면 원본 에러를 그대로 throw해야 한다', async () => {
      // Arrange
      const genericError = new Error('Network connection failed');
      mockedAxios.post.mockRejectedValue(genericError);
      mockedAxios.isAxiosError.mockReturnValue(false);

      // Act & Assert
      await expect(issueBillingKey(testAuthKey, testCustomerKey, testSecretKey)).rejects.toThrow(
        'Network connection failed'
      );
    });
  });

  describe('approveBilling', () => {
    test('정기결제 승인이 성공하면 paymentKey와 approvedAt을 반환해야 한다', async () => {
      // Arrange
      const mockApprovedAt = '2025-10-29T10:00:00+09:00';
      const mockResponse = {
        data: {
          paymentKey: testPaymentKey,
          approvedAt: mockApprovedAt,
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await approveBilling(
        testBillingKey,
        TOSS_CONSTANTS.PRO_PRICE,
        testOrderId,
        TOSS_CONSTANTS.ORDER_NAME,
        testSecretKey
      );

      // Assert
      expect(result).toEqual({
        paymentKey: testPaymentKey,
        approvedAt: new Date(mockApprovedAt),
      });
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/billing/${testBillingKey}`),
        {
          amount: TOSS_CONSTANTS.PRO_PRICE,
          orderId: testOrderId,
          orderName: TOSS_CONSTANTS.ORDER_NAME,
          customerEmail: undefined,
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic'),
          }),
        })
      );
    });

    test('결제 실패 시 에러 메시지와 함께 throw해야 한다', async () => {
      // Arrange
      const errorMessage = 'Insufficient balance';
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          data: {
            message: errorMessage,
          },
        },
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      // Act & Assert
      await expect(
        approveBilling(
          testBillingKey,
          TOSS_CONSTANTS.PRO_PRICE,
          testOrderId,
          TOSS_CONSTANTS.ORDER_NAME,
          testSecretKey
        )
      ).rejects.toThrow(`Billing approval failed: ${errorMessage}`);
    });

    test('일반 에러가 발생하면 원본 에러를 그대로 throw해야 한다', async () => {
      // Arrange
      const genericError = new Error('Database connection timeout');
      mockedAxios.post.mockRejectedValue(genericError);
      mockedAxios.isAxiosError.mockReturnValue(false);

      // Act & Assert
      await expect(
        approveBilling(
          testBillingKey,
          TOSS_CONSTANTS.PRO_PRICE,
          testOrderId,
          TOSS_CONSTANTS.ORDER_NAME,
          testSecretKey
        )
      ).rejects.toThrow('Database connection timeout');
    });
  });

  describe('deleteBillingKey', () => {
    test('빌링키 삭제가 성공하면 에러 없이 완료되어야 한다', async () => {
      // Arrange
      mockedAxios.delete.mockResolvedValue({});

      // Act & Assert
      await expect(deleteBillingKey(testBillingKey, testSecretKey)).resolves.not.toThrow();
      expect(mockedAxios.delete).toHaveBeenCalledTimes(1);
      expect(mockedAxios.delete).toHaveBeenCalledWith(
        expect.stringContaining(`/billing/authorizations/${testBillingKey}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic'),
          }),
        })
      );
    });

    test('빌링키 삭제 실패 시 에러를 throw해야 한다', async () => {
      // Arrange
      const errorMessage = 'Billing key not found';
      mockedAxios.delete.mockRejectedValue({
        isAxiosError: true,
        response: {
          data: {
            message: errorMessage,
          },
        },
      });
      mockedAxios.isAxiosError.mockReturnValue(true);

      // Act & Assert
      await expect(deleteBillingKey(testBillingKey, testSecretKey)).rejects.toThrow(
        `Billing key deletion failed: ${errorMessage}`
      );
    });

    test('일반 에러가 발생하면 원본 에러를 그대로 throw해야 한다', async () => {
      // Arrange
      const genericError = new Error('Unexpected server error');
      mockedAxios.delete.mockRejectedValue(genericError);
      mockedAxios.isAxiosError.mockReturnValue(false);

      // Act & Assert
      await expect(deleteBillingKey(testBillingKey, testSecretKey)).rejects.toThrow(
        'Unexpected server error'
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    const testWebhookSecret = 'webhook_secret_1234';
    const testPayload = JSON.stringify({
      eventType: 'PAYMENT_APPROVED',
      data: {
        paymentKey: testPaymentKey,
        amount: TOSS_CONSTANTS.PRO_PRICE,
      },
    });

    test('올바른 서명은 true를 반환해야 한다', () => {
      // Arrange
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', testWebhookSecret);
      hmac.update(testPayload);
      const validSignature = hmac.digest('hex');

      // Act
      const result = verifyWebhookSignature(testPayload, validSignature, testWebhookSecret);

      // Assert
      expect(result).toBe(true);
    });

    test('잘못된 서명은 false를 반환해야 한다', () => {
      // Arrange
      const invalidSignature = 'invalid_signature_1234567890';

      // Act
      const result = verifyWebhookSignature(testPayload, invalidSignature, testWebhookSecret);

      // Assert
      expect(result).toBe(false);
    });

    test('변조된 페이로드는 false를 반환해야 한다', () => {
      // Arrange
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', testWebhookSecret);
      hmac.update(testPayload);
      const validSignature = hmac.digest('hex');

      // 페이로드 변조
      const tamperedPayload = testPayload.replace(
        TOSS_CONSTANTS.PRO_PRICE.toString(),
        '100'
      );

      // Act
      const result = verifyWebhookSignature(tamperedPayload, validSignature, testWebhookSecret);

      // Assert
      expect(result).toBe(false);
    });

    test('빈 페이로드도 올바르게 검증해야 한다', () => {
      // Arrange
      const emptyPayload = '';
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', testWebhookSecret);
      hmac.update(emptyPayload);
      const signature = hmac.digest('hex');

      // Act
      const result = verifyWebhookSignature(emptyPayload, signature, testWebhookSecret);

      // Assert
      expect(result).toBe(true);
    });
  });
});
