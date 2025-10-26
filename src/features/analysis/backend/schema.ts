import { z } from 'zod';

/**
 * 분석 결과 스키마
 */
export const analysisSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  birthDate: z.string(), // ISO date
  birthTime: z.string().optional(), // HH:mm
  isLunar: z.boolean(),
  gender: z.enum(['male', 'female']),
  result: z.object({
    basic: z.object({
      천간지지: z.string(),
      오행분석: z.string(),
    }),
    personality: z.object({
      특성: z.string(),
      장단점: z.string(),
    }),
    fortune: z.object({
      대운: z.string(),
      세운: z.string(),
      직업운: z.string(),
      재물운: z.string(),
      건강운: z.string(),
      연애운: z.string(),
      대인관계운: z.string(),
    }),
    advice: z.object({
      긍정적방향: z.string(),
      주의점: z.string(),
    }),
  }),
  modelUsed: z.enum(['gemini-2.5-flash', 'gemini-2.5-pro']),
  createdAt: z.string().datetime(),
});

/**
 * 분석 이력 조회 응답 스키마
 */
export const analysisHistoryResponseSchema = z.object({
  data: z.array(analysisSchema),
  total: z.number().int(),
  page: z.number().int(),
  totalPages: z.number().int(),
});

/**
 * 분석 생성 요청 스키마
 */
export const createAnalysisRequestSchema = z.object({
  birthDate: z.string(), // YYYY-MM-DD
  birthTime: z.string().optional(), // HH:mm or undefined
  isLunar: z.boolean(),
  gender: z.enum(['male', 'female']),
});

/**
 * 분석 ID 파라미터 스키마
 */
export const AnalysisIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * 분석 결과 내부 스키마 (JSONB 필드)
 */
export const analysisResultContentSchema = z.object({
  basic: z.object({
    천간지지: z.string(),
    오행분석: z.string(),
  }),
  personality: z.object({
    특성: z.string(),
    장단점: z.string(),
  }),
  fortune: z.object({
    대운: z.string(),
    세운: z.string(),
    직업운: z.string(),
    재물운: z.string(),
    건강운: z.string(),
    연애운: z.string(),
    대인관계운: z.string(),
  }),
  advice: z.object({
    긍정적방향: z.string(),
    주의점: z.string(),
  }),
});

/**
 * 분석 결과 스키마 (별칭)
 */
export const AnalysisResultSchema = analysisSchema;

/**
 * 분석 상세 응답 스키마
 */
export const analysisDetailResponseSchema = z.object({
  analysis: analysisSchema,
});

export type Analysis = z.infer<typeof analysisSchema>;
export type AnalysisHistoryResponse = z.infer<typeof analysisHistoryResponseSchema>;
export type CreateAnalysisRequest = z.infer<typeof createAnalysisRequestSchema>;
export type AnalysisIdParams = z.infer<typeof AnalysisIdParamsSchema>;
export type AnalysisDetailResponse = z.infer<typeof analysisDetailResponseSchema>;

// Aliases for backward compatibility
export type AnalysisResponse = Analysis;
export type AnalysisResult = Analysis;
