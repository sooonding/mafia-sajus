import { z } from 'zod';

/**
 * 구독 정보 스키마
 */
const subscriptionInfoSchema = z.object({
  status: z.enum(['active', 'canceled', 'expired']),
  nextBillingDate: z.string().datetime().optional(),
});

/**
 * 현재 사용자 조회 응답 스키마
 */
export const currentUserResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string(),
  email: z.string().email(),
  subscriptionTier: z.enum(['free', 'pro']),
  subscription: subscriptionInfoSchema.optional(),
});

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
