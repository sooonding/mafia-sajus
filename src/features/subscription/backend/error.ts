export const subscriptionErrorCodes = {
  subscriptionNotFound: 'SUBSCRIPTION_NOT_FOUND',
  subscriptionAlreadyActive: 'SUBSCRIPTION_ALREADY_ACTIVE',
  subscriptionAlreadyCanceled: 'SUBSCRIPTION_ALREADY_CANCELED',
  subscriptionExpired: 'SUBSCRIPTION_EXPIRED',
  subscriptionNotActive: 'SUBSCRIPTION_NOT_ACTIVE',
  billingKeyIssueFailed: 'BILLING_KEY_ISSUE_FAILED',
  paymentApprovalFailed: 'PAYMENT_APPROVAL_FAILED',
  billingKeyDeleteFailed: 'BILLING_KEY_DELETE_FAILED',
  tosspaymentsApiError: 'TOSSPAYMENTS_API_ERROR',
} as const;

type SubscriptionErrorValue =
  (typeof subscriptionErrorCodes)[keyof typeof subscriptionErrorCodes];

export type SubscriptionServiceError = SubscriptionErrorValue;
