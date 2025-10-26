import { z } from 'zod';

/**
 * 사용량 정보 응답 스키마
 */
export const usageInfoResponseSchema = z.object({
  used: z.number().int().min(0),
  limit: z.number().int().min(1),
  remaining: z.number().int().min(0),
  nextResetDate: z.string().datetime().optional(),
});

export type UsageInfoResponse = z.infer<typeof usageInfoResponseSchema>;
