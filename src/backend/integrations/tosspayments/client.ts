import axios from 'axios';
import * as crypto from 'crypto';

/**
 * 토스페이먼츠 API 클라이언트
 *
 * 빌링키 발급, 정기결제 승인, Webhook 검증 기능을 제공합니다.
 */

const TOSS_API_BASE_URL = 'https://api.tosspayments.com/v1';

export const TOSS_CONSTANTS = {
  PRO_PRICE: 3900,
  ORDER_NAME: 'Pro 구독 (월 3,900원)',
} as const;

/**
 * 빌링키 발급
 *
 * @param authKey 카드 인증 키 (결제창에서 받은 값)
 * @param customerKey 고객 고유 키 (사용자 ID)
 * @param secretKey 토스페이먼츠 시크릿 키
 * @returns 빌링키 및 고객 키
 */
export async function issueBillingKey(
  authKey: string,
  customerKey: string,
  secretKey: string
): Promise<{ billingKey: string; customerKey: string }> {
  const url = `${TOSS_API_BASE_URL}/billing/authorizations/issue`;

  try {
    const response = await axios.post(
      url,
      {
        authKey,
        customerKey,
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { billingKey, customerKey: returnedCustomerKey } = response.data;
    return { billingKey, customerKey: returnedCustomerKey };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      throw new Error(`Billing key issuance failed: ${message}`);
    }
    throw error;
  }
}

/**
 * 정기결제 승인
 *
 * @param billingKey 빌링키
 * @param amount 결제 금액
 * @param orderId 주문 ID (고유값)
 * @param orderName 주문명
 * @param secretKey 토스페이먼츠 시크릿 키
 * @returns 결제 키 및 승인 시각
 */
export async function approveBilling(
  billingKey: string,
  amount: number,
  orderId: string,
  orderName: string,
  secretKey: string
): Promise<{ paymentKey: string; approvedAt: Date }> {
  const url = `${TOSS_API_BASE_URL}/billing/${billingKey}`;

  try {
    const response = await axios.post(
      url,
      {
        amount,
        orderId,
        orderName,
        customerEmail: undefined, // 선택사항
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { paymentKey, approvedAt } = response.data;
    return { paymentKey, approvedAt: new Date(approvedAt) };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      throw new Error(`Billing approval failed: ${message}`);
    }
    throw error;
  }
}

/**
 * 빌링키 삭제
 *
 * @param billingKey 빌링키
 * @param secretKey 토스페이먼츠 시크릿 키
 */
export async function deleteBillingKey(
  billingKey: string,
  secretKey: string
): Promise<void> {
  const url = `${TOSS_API_BASE_URL}/billing/authorizations/${billingKey}`;

  try {
    await axios.delete(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      throw new Error(`Billing key deletion failed: ${message}`);
    }
    throw error;
  }
}

/**
 * Webhook 서명 검증
 *
 * 토스페이먼츠 Webhook의 서명을 검증하여 요청이 정당한지 확인합니다.
 *
 * @param payload Webhook 페이로드 (문자열)
 * @param signature Webhook 헤더의 서명 값
 * @param webhookSecret Webhook 시크릿 키
 * @returns 서명이 유효하면 true
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): boolean {
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  return signature === expectedSignature;
}
