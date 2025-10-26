import { loadTossPayments } from '@tosspayments/payment-sdk';

/**
 * 토스페이먼츠 SDK 래퍼
 */

export interface TossPaymentRequest {
  amount: number;
  orderId: string;
  orderName: string;
  customerKey: string;
  successUrl: string;
  failUrl: string;
}

/**
 * 토스페이먼츠 결제 요청
 *
 * @param request 결제 요청 정보
 * @throws {Error} 클라이언트 키가 설정되지 않은 경우
 */
export async function requestTossPayment(request: TossPaymentRequest) {
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

  if (!clientKey) {
    throw new Error('NEXT_PUBLIC_TOSS_CLIENT_KEY is not defined');
  }

  const tossPayments = await loadTossPayments(clientKey);

  return tossPayments.requestBillingAuth('카드', {
    customerKey: request.customerKey,
    successUrl: request.successUrl,
    failUrl: request.failUrl,
  });
}
