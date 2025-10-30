import { callGeminiAnalysis, type GeminiAnalysisRequest } from './client';
import { GoogleGenerativeAI } from '@google/generative-ai';

// GoogleGenerativeAI 모듈 Mock
jest.mock('@google/generative-ai');

describe('callGeminiAnalysis', () => {
  let mockGenerateContent: jest.Mock;
  const testApiKey = 'test-api-key';
  const testRequest: GeminiAnalysisRequest = {
    birthDate: new Date('1990-01-01'),
    birthTime: '10:00',
    isLunar: false,
    gender: 'male',
  };

  const mockValidResponse = {
    basic: {
      천간지지: '경오 무인 갑진 을사',
      오행분석: '화 토가 강하고 금 수가 약함',
    },
    personality: {
      특성: '활발하고 외향적인 성격',
      장단점: '장점: 리더십, 단점: 급함',
    },
    fortune: {
      대운: '현재 대운 좋음',
      세운: '올해 세운 보통',
      직업운: '창업 적합',
      재물운: '재테크 시작 좋음',
      건강운: '건강 양호',
      연애운: '좋은 인연 만남',
      대인관계운: '사회생활 원만',
    },
    advice: {
      긍정적방향: '긍정적 마인드 유지',
      주의점: '급한 마음 주의',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock generateContent 함수 생성
    mockGenerateContent = jest.fn();

    // GoogleGenerativeAI Mock 설정
    (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>).mockImplementation(
      () =>
        ({
          getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: mockGenerateContent,
          }),
        }) as any
    );
  });

  test('API 호출이 성공하면 파싱된 결과를 반환해야 한다', async () => {
    // Arrange
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(mockValidResponse),
      },
    });

    // Act
    const result = await callGeminiAnalysis(testRequest, 'gemini-2.5-flash', testApiKey);

    // Assert
    expect(result).toEqual(mockValidResponse);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  test('마크다운 코드 블록(```json)을 포함한 응답도 올바르게 파싱해야 한다', async () => {
    // Arrange
    const responseWithCodeBlock = '```json\n' + JSON.stringify(mockValidResponse) + '\n```';
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => responseWithCodeBlock,
      },
    });

    // Act
    const result = await callGeminiAnalysis(testRequest, 'gemini-2.5-flash', testApiKey);

    // Assert
    expect(result).toEqual(mockValidResponse);
  });

  test('일반 코드 블록(```)을 포함한 응답도 올바르게 파싱해야 한다', async () => {
    // Arrange
    const responseWithCodeBlock = '```\n' + JSON.stringify(mockValidResponse) + '\n```';
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => responseWithCodeBlock,
      },
    });

    // Act
    const result = await callGeminiAnalysis(testRequest, 'gemini-2.5-flash', testApiKey);

    // Assert
    expect(result).toEqual(mockValidResponse);
  });

  test('할당량 초과 에러(429)가 발생하면 재시도 없이 즉시 실패해야 한다', async () => {
    // Arrange
    const quotaError = new Error('API call failed: 429 Quota exceeded');
    mockGenerateContent.mockRejectedValue(quotaError);

    // Act & Assert
    await expect(
      callGeminiAnalysis(testRequest, 'gemini-2.5-flash', testApiKey)
    ).rejects.toThrow('API_QUOTA_EXCEEDED');

    // 재시도하지 않았는지 확인
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  test('일시적 오류(500)가 발생하면 최대 3회까지 재시도해야 한다', async () => {
    // Arrange
    const serverError = new Error('API call failed: 500 Internal Server Error');
    mockGenerateContent
      .mockRejectedValueOnce(serverError) // 1회 실패
      .mockRejectedValueOnce(serverError) // 2회 실패
      .mockResolvedValueOnce({
        // 3회 성공
        response: {
          text: () => JSON.stringify(mockValidResponse),
        },
      });

    // Act
    const result = await callGeminiAnalysis(testRequest, 'gemini-2.5-flash', testApiKey);

    // Assert
    expect(result).toEqual(mockValidResponse);
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  test('3회 재시도 후에도 실패하면 에러를 throw해야 한다', async () => {
    // Arrange
    const serverError = new Error('API call failed: 503 Service Unavailable');
    mockGenerateContent.mockRejectedValue(serverError);

    // Act & Assert
    await expect(
      callGeminiAnalysis(testRequest, 'gemini-2.5-flash', testApiKey)
    ).rejects.toThrow('EXTERNAL_API_ERROR');

    // 3회 재시도했는지 확인
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  test('잘못된 JSON 형식이 반환되면 에러를 throw해야 한다', async () => {
    // Arrange
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'This is not valid JSON',
      },
    });

    // Act & Assert
    await expect(
      callGeminiAnalysis(testRequest, 'gemini-2.5-flash', testApiKey)
    ).rejects.toThrow('Failed to parse Gemini response');
  });

  test('필수 필드가 누락된 응답은 에러를 throw해야 한다', async () => {
    // Arrange
    const incompleteResponse = {
      basic: {
        천간지지: '경오 무인',
        오행분석: '화 토 강함',
      },
      // personality, fortune, advice 필드 누락
    };

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(incompleteResponse),
      },
    });

    // Act & Assert
    await expect(
      callGeminiAnalysis(testRequest, 'gemini-2.5-flash', testApiKey)
    ).rejects.toThrow('Failed to parse Gemini response');
  });
});
