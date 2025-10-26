import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini API 클라이언트
 *
 * Google Gemini AI를 사용한 사주 분석 기능을 제공합니다.
 */

export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export interface GeminiAnalysisRequest {
  birthDate: Date;
  birthTime?: string;
  isLunar: boolean;
  gender: 'male' | 'female';
}

export interface GeminiAnalysisResult {
  basic: {
    천간지지: string;
    오행분석: string;
  };
  personality: {
    특성: string;
    장단점: string;
  };
  fortune: {
    대운: string;
    세운: string;
    직업운: string;
    재물운: string;
    건강운: string;
    연애운: string;
    대인관계운: string;
  };
  advice: {
    긍정적방향: string;
    주의점: string;
  };
}

/**
 * Gemini API 호출 (재시도 포함)
 *
 * @param request 사주 분석 요청 정보
 * @param model 사용할 모델 (Flash 또는 Pro)
 * @param apiKey Gemini API 키
 * @returns 분석 결과
 * @throws {Error} API 호출 실패 또는 할당량 초과 시
 */
export async function callGeminiAnalysis(
  request: GeminiAnalysisRequest,
  model: GeminiModel,
  apiKey: string
): Promise<GeminiAnalysisResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelInstance = genAI.getGenerativeModel({ model });

  // 프롬프트 생성
  const prompt = buildSajuPrompt(request);

  // 재시도 로직 (최대 3회, 지수 백오프)
  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await modelInstance.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // JSON 파싱 시도
      const analysisResult = parseGeminiResponse(text);
      return analysisResult;
    } catch (error) {
      lastError = error as Error;

      // 할당량 초과 에러 (429)는 재시도하지 않음
      if (lastError.message && lastError.message.includes('429')) {
        throw new Error(
          'API_QUOTA_EXCEEDED: Gemini API 할당량이 초과되었습니다'
        );
      }

      // 마지막 시도가 아니면 대기 후 재시도
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * 2 ** (attempt - 1), 3000);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw new Error(
    `EXTERNAL_API_ERROR: Gemini API 호출 실패 (${maxRetries}회 시도): ${lastError?.message}`
  );
}

/**
 * 사주 분석 프롬프트 생성
 */
function buildSajuPrompt(request: GeminiAnalysisRequest): string {
  const { birthDate, birthTime, isLunar, gender } = request;

  const year = birthDate.getFullYear();
  const month = birthDate.getMonth() + 1;
  const day = birthDate.getDate();
  const calendar = isLunar ? '음력' : '양력';
  const genderText = gender === 'male' ? '남성' : '여성';
  const timeText = birthTime || '시간 모름';

  return `
당신은 전문 사주 명리학자입니다. 다음 정보를 바탕으로 사주팔자 분석을 해주세요.

생년월일: ${year}년 ${month}월 ${day}일 (${calendar})
출생 시간: ${timeText}
성별: ${genderText}

다음 형식의 JSON으로 응답해주세요:

{
  "basic": {
    "천간지지": "천간과 지지를 포함한 사주팔자 구성 설명",
    "오행분석": "오행의 균형과 강약 분석"
  },
  "personality": {
    "특성": "타고난 성격과 기질 설명",
    "장단점": "성격의 장점과 단점 분석"
  },
  "fortune": {
    "대운": "현재 대운 흐름과 영향",
    "세운": "올해 세운 분석",
    "직업운": "적합한 직업과 커리어 방향",
    "재물운": "재물 운세 및 재테크 조언",
    "건강운": "건강 상태 및 주의사항",
    "연애운": "연애 및 결혼운 분석",
    "대인관계운": "대인관계 및 사회생활 운세"
  },
  "advice": {
    "긍정적방향": "앞으로 나아갈 긍정적인 방향과 조언",
    "주의점": "주의해야 할 사항과 개선 방향"
  }
}

JSON 형식만 응답하고, 다른 설명은 포함하지 마세요.
`.trim();
}

/**
 * Gemini 응답 파싱
 */
function parseGeminiResponse(text: string): GeminiAnalysisResult {
  try {
    // JSON 블록 추출 (마크다운 코드 블록 제거)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const result = JSON.parse(jsonText) as GeminiAnalysisResult;

    // 필수 필드 검증
    if (
      !result.basic ||
      !result.personality ||
      !result.fortune ||
      !result.advice
    ) {
      throw new Error('Invalid response structure');
    }

    return result;
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini response: ${(error as Error).message}`
    );
  }
}
