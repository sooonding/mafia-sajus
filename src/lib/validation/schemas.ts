import { z } from 'zod';

/**
 * 폼 검증 스키마 (Zod)
 *
 * React Hook Form과 함께 사용됩니다.
 */

/**
 * 생년월일 (과거 날짜만)
 */
export const birthDateSchema = z
  .date()
  .refine((date) => date <= new Date(), '미래 날짜는 선택할 수 없습니다')
  .refine(
    (date) => date >= new Date('1900-01-01'),
    '1900년 이후 날짜를 선택해주세요'
  );

/**
 * 출생 시간 (선택)
 */
export const birthTimeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):([0-5]\d)$/,
    '올바른 시간 형식이 아닙니다 (HH:MM)'
  )
  .optional();

/**
 * 양력/음력
 */
export const calendarTypeSchema = z.enum(['solar', 'lunar']);

/**
 * 성별
 */
export const genderSchema = z.enum(['male', 'female']);

/**
 * 사주 분석 요청 폼 (프론트엔드용)
 */
export const analysisRequestSchema = z.object({
  birthDate: birthDateSchema.optional(),
  birthTime: birthTimeSchema,
  birthTimeUnknown: z.boolean().default(false),
  isLunar: z.boolean().default(false),
  gender: genderSchema.optional(),
}).superRefine((data, ctx) => {
  // birthDate 필수 검증
  if (!data.birthDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '생년월일을 입력해주세요',
      path: ['birthDate'],
    });
  }

  // gender 필수 검증
  if (!data.gender) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '성별을 선택해주세요',
      path: ['gender'],
    });
  }

  // birthTime 검증 (모름 체크하지 않았을 때)
  if (!data.birthTimeUnknown && data.birthTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(data.birthTime)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '올바른 시간 형식이 아닙니다 (HH:MM)',
      path: ['birthTime'],
    });
  }
});

export type AnalysisRequestInput = z.infer<typeof analysisRequestSchema>;
