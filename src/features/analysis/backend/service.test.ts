import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createAnalysis,
  getAnalysisById,
  getAnalysisHistory,
  getAnalysisDetail,
} from './service';
import { checkUsageLimit } from '@/backend/services/usage';
import { callGeminiAnalysis } from '@/backend/integrations/gemini/client';
import { AnalysisErrorCode } from './error';
import type { CreateAnalysisRequest } from './schema';

// Mock 의존성
jest.mock('@/backend/services/usage');
jest.mock('@/backend/integrations/gemini/client');

const mockedCheckUsageLimit = checkUsageLimit as jest.MockedFunction<typeof checkUsageLimit>;
const mockedCallGeminiAnalysis = callGeminiAnalysis as jest.MockedFunction<
  typeof callGeminiAnalysis
>;

describe('createAnalysis', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;
  let mockLogger: any;
  const testApiKey = 'test-gemini-api-key';
  const testUserId = 'user-uuid-1234';

  const testRequest: CreateAnalysisRequest = {
    birthDate: '1990-01-01',
    birthTime: '10:00',
    isLunar: false,
    gender: 'male',
  };

  const mockGeminiResponse = {
    basic: {
      천간지지: '경오 무인 갑진 을사',
      오행분석: '화 토가 강함',
    },
    personality: {
      특성: '활발함',
      장단점: '리더십 강함',
    },
    fortune: {
      대운: '좋음',
      세운: '보통',
      직업운: '창업 적합',
      재물운: '재테크 좋음',
      건강운: '양호',
      연애운: '좋은 인연',
      대인관계운: '원만',
    },
    advice: {
      긍정적방향: '긍정적 마인드',
      주의점: '급한 마음 주의',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase 클라이언트
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    } as any;

    // Mock Logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  test('무료 유저가 첫 분석을 생성하면 Flash 모델을 사용해야 한다', async () => {
    // Arrange
    // 1. 사용자 조회 결과 (첫 번째 single 호출)
    // 2. analyses 삽입 결과 (두 번째 single 호출)
    (mockSupabase.single as jest.Mock)
      .mockResolvedValueOnce({
        data: { id: testUserId, subscription_tier: 'free' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'analysis-uuid-1234',
          user_id: testUserId,
          birth_date: testRequest.birthDate,
          birth_time: testRequest.birthTime,
          is_lunar: testRequest.isLunar,
          gender: testRequest.gender,
          result: mockGeminiResponse,
          model_used: 'gemini-2.5-flash',
          created_at: '2025-10-29T10:00:00Z',
        },
        error: null,
      });

    // 3. 사용량 체크 - 1회 남음
    mockedCheckUsageLimit.mockResolvedValue({
      subscriptionTier: 'free',
      used: 0,
      limit: 1,
      remaining: 1,
    });

    // 4. Gemini API 호출 성공
    mockedCallGeminiAnalysis.mockResolvedValue(mockGeminiResponse);

    // Act
    const result = await createAnalysis(
      mockSupabase,
      testUserId,
      testRequest,
      mockLogger,
      testApiKey
    );

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userId).toBe(testUserId);
      expect(result.data.modelUsed).toBe('gemini-2.5-flash');
      expect(result.data.result).toEqual(mockGeminiResponse);
    }
    expect(mockedCallGeminiAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        birthDate: new Date(testRequest.birthDate),
        gender: 'male',
      }),
      'gemini-2.5-flash',
      testApiKey
    );
  });

  test('Pro 유저가 분석을 생성하면 Pro 모델을 사용해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock)
      .mockResolvedValueOnce({
        data: { id: testUserId, subscription_tier: 'pro' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'analysis-uuid-5678',
          user_id: testUserId,
          birth_date: testRequest.birthDate,
          birth_time: testRequest.birthTime,
          is_lunar: testRequest.isLunar,
          gender: testRequest.gender,
          result: mockGeminiResponse,
          model_used: 'gemini-2.5-pro',
          created_at: '2025-10-29T10:00:00Z',
        },
        error: null,
      });

    mockedCheckUsageLimit.mockResolvedValue({
      subscriptionTier: 'pro',
      used: 5,
      limit: 10,
      remaining: 5,
      nextResetDate: new Date('2025-11-01'),
    });

    mockedCallGeminiAnalysis.mockResolvedValue(mockGeminiResponse);

    // Act
    const result = await createAnalysis(
      mockSupabase,
      testUserId,
      testRequest,
      mockLogger,
      testApiKey
    );

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.modelUsed).toBe('gemini-2.5-pro');
    }
    expect(mockedCallGeminiAnalysis).toHaveBeenCalledWith(
      expect.anything(),
      'gemini-2.5-pro',
      testApiKey
    );
  });

  test('사용자를 찾을 수 없으면 404 에러를 반환해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'User not found' },
    });

    // Act
    const result = await createAnalysis(
      mockSupabase,
      'non-existent-user',
      testRequest,
      mockLogger,
      testApiKey
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(AnalysisErrorCode.USER_NOT_FOUND);
    }
  });

  test('사용량이 초과되면 400 에러를 반환해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: { id: testUserId, subscription_tier: 'free' },
      error: null,
    });

    // 사용량 초과
    mockedCheckUsageLimit.mockResolvedValue({
      subscriptionTier: 'free',
      used: 1,
      limit: 1,
      remaining: 0,
    });

    // Act
    const result = await createAnalysis(
      mockSupabase,
      testUserId,
      testRequest,
      mockLogger,
      testApiKey
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.code).toBe(AnalysisErrorCode.USAGE_LIMIT_EXCEEDED);
      expect(result.error.message).toContain('무료 체험');
    }
  });

  test('Gemini API 할당량 초과 시 503 에러를 반환해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: { id: testUserId, subscription_tier: 'free' },
      error: null,
    });

    mockedCheckUsageLimit.mockResolvedValue({
      subscriptionTier: 'free',
      used: 0,
      limit: 1,
      remaining: 1,
    });

    // Gemini API 할당량 초과 에러
    mockedCallGeminiAnalysis.mockRejectedValue(
      new Error('API_QUOTA_EXCEEDED: Gemini API 할당량이 초과되었습니다')
    );

    // Act
    const result = await createAnalysis(
      mockSupabase,
      testUserId,
      testRequest,
      mockLogger,
      testApiKey
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error.code).toBe(AnalysisErrorCode.API_QUOTA_EXCEEDED);
    }
  });

  test('Gemini API 일반 오류 시 503 에러를 반환해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: { id: testUserId, subscription_tier: 'free' },
      error: null,
    });

    mockedCheckUsageLimit.mockResolvedValue({
      subscriptionTier: 'free',
      used: 0,
      limit: 1,
      remaining: 1,
    });

    mockedCallGeminiAnalysis.mockRejectedValue(
      new Error('EXTERNAL_API_ERROR: Service unavailable')
    );

    // Act
    const result = await createAnalysis(
      mockSupabase,
      testUserId,
      testRequest,
      mockLogger,
      testApiKey
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error.code).toBe(AnalysisErrorCode.AI_SERVICE_ERROR);
    }
  });

  test('분석 결과 저장 실패 시 500 에러를 반환해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock)
      .mockResolvedValueOnce({
        data: { id: testUserId, subscription_tier: 'free' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Database insert failed' },
      });

    mockedCheckUsageLimit.mockResolvedValue({
      subscriptionTier: 'free',
      used: 0,
      limit: 1,
      remaining: 1,
    });

    mockedCallGeminiAnalysis.mockResolvedValue(mockGeminiResponse);

    // Act
    const result = await createAnalysis(
      mockSupabase,
      testUserId,
      testRequest,
      mockLogger,
      testApiKey
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(AnalysisErrorCode.DATABASE_ERROR);
    }
  });
});

describe('getAnalysisById', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;
  const testUserId = 'user-uuid-1234';
  const testAnalysisId = 'analysis-uuid-5678';

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    } as any;
  });

  test('분석 조회 성공', async () => {
    // Arrange
    const mockAnalysis = {
      id: testAnalysisId,
      user_id: testUserId,
      birth_date: '1990-01-01',
      birth_time: '10:00',
      is_lunar: false,
      gender: 'male',
      result: { basic: {}, personality: {}, fortune: {}, advice: {} },
      model_used: 'gemini-2.5-flash',
      created_at: '2025-10-29T10:00:00Z',
    };

    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: mockAnalysis,
      error: null,
    });

    // Act
    const result = await getAnalysisById(mockSupabase, testUserId, testAnalysisId);

    // Assert
    expect(result.id).toBe(testAnalysisId);
    expect(result.userId).toBe(testUserId);
  });

  test('분석을 찾을 수 없으면 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    // Act & Assert
    await expect(getAnalysisById(mockSupabase, testUserId, testAnalysisId)).rejects.toThrow(
      'ANALYSIS_NOT_FOUND'
    );
  });

  test('다른 사용자의 분석을 조회하면 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: {
        id: testAnalysisId,
        user_id: 'different-user-id',
        birth_date: '1990-01-01',
        result: {},
        created_at: '2025-10-29T10:00:00Z',
      },
      error: null,
    });

    // Act & Assert
    await expect(getAnalysisById(mockSupabase, testUserId, testAnalysisId)).rejects.toThrow(
      'ANALYSIS_FORBIDDEN'
    );
  });
});

describe('getAnalysisHistory', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;
  const testUserId = 'user-uuid-1234';

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn(),
    } as any;
  });

  test('페이지네이션을 포함한 분석 이력 조회 성공', async () => {
    // Arrange
    const mockAnalyses = [
      {
        id: 'analysis-1',
        user_id: testUserId,
        birth_date: '1990-01-01',
        birth_time: '10:00',
        is_lunar: false,
        gender: 'male',
        result: { basic: {}, personality: {}, fortune: {}, advice: {} },
        model_used: 'gemini-2.5-flash',
        created_at: '2025-10-29T10:00:00Z',
      },
      {
        id: 'analysis-2',
        user_id: testUserId,
        birth_date: '1990-01-02',
        birth_time: '11:00',
        is_lunar: true,
        gender: 'female',
        result: { basic: {}, personality: {}, fortune: {}, advice: {} },
        model_used: 'gemini-2.5-pro',
        created_at: '2025-10-28T10:00:00Z',
      },
    ];

    // count 조회
    (mockSupabase.select as jest.Mock).mockReturnValueOnce({
      eq: jest.fn().mockResolvedValue({
        count: 10,
        error: null,
      }),
    });

    // 실제 데이터 조회
    (mockSupabase.select as jest.Mock).mockReturnValueOnce(mockSupabase);
    (mockSupabase.range as jest.Mock).mockResolvedValue({
      data: mockAnalyses,
      error: null,
    });

    // Act
    const result = await getAnalysisHistory(mockSupabase, testUserId, 1, 5);

    // Assert
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(10);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(2);
    expect(result.data[0].id).toBe('analysis-1');
  });

  test('빈 결과를 반환할 수 있어야 한다', async () => {
    // Arrange
    (mockSupabase.select as jest.Mock).mockReturnValueOnce({
      eq: jest.fn().mockResolvedValue({
        count: 0,
        error: null,
      }),
    });

    (mockSupabase.select as jest.Mock).mockReturnValueOnce(mockSupabase);
    (mockSupabase.range as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    });

    // Act
    const result = await getAnalysisHistory(mockSupabase, testUserId, 1, 10);

    // Assert
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  test('count 조회 실패 시 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.select as jest.Mock).mockReturnValueOnce({
      eq: jest.fn().mockResolvedValue({
        count: null,
        error: { message: 'Database error' },
      }),
    });

    // Act & Assert
    await expect(getAnalysisHistory(mockSupabase, testUserId, 1, 10)).rejects.toThrow(
      'FAILED_TO_COUNT_ANALYSES'
    );
  });

  test('데이터 조회 실패 시 에러를 throw해야 한다', async () => {
    // Arrange
    (mockSupabase.select as jest.Mock).mockReturnValueOnce({
      eq: jest.fn().mockResolvedValue({
        count: 5,
        error: null,
      }),
    });

    (mockSupabase.select as jest.Mock).mockReturnValueOnce(mockSupabase);
    (mockSupabase.range as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Failed to fetch data' },
    });

    // Act & Assert
    await expect(getAnalysisHistory(mockSupabase, testUserId, 1, 10)).rejects.toThrow(
      'FAILED_TO_FETCH_ANALYSES'
    );
  });
});

describe('getAnalysisDetail', () => {
  let mockSupabase: jest.Mocked<SupabaseClient>;
  const testUserId = 'user-uuid-1234';
  const testAnalysisId = 'analysis-uuid-5678';

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    } as any;
  });

  test('분석 상세 조회 성공', async () => {
    // Arrange
    const mockAnalysis = {
      id: testAnalysisId,
      user_id: testUserId,
      birth_date: '1990-01-01',
      birth_time: '10:00',
      is_lunar: false,
      gender: 'male',
      result: {
        basic: {
          천간지지: '경오 무인 갑진 을사',
          오행분석: '화 토가 강함',
        },
        personality: {
          특성: '활발함',
          장단점: '리더십 강함',
        },
        fortune: {
          대운: '좋음',
          세운: '보통',
          직업운: '창업 적합',
          재물운: '재테크 좋음',
          건강운: '양호',
          연애운: '좋은 인연',
          대인관계운: '원만',
        },
        advice: {
          긍정적방향: '긍정적 마인드',
          주의점: '급한 마음 주의',
        },
      },
      model_used: 'gemini-2.5-flash',
      created_at: '2025-10-29T10:00:00Z',
    };

    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: mockAnalysis,
      error: null,
    });

    // Act
    const result = await getAnalysisDetail(mockSupabase, testAnalysisId, testUserId);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.analysis.id).toBe(testAnalysisId);
      expect(result.data.analysis.userId).toBe(testUserId);
      expect(result.data.analysis.result.basic.천간지지).toBe('경오 무인 갑진 을사');
    }
  });

  test('분석을 찾을 수 없으면 404 에러를 반환해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    // Act
    const result = await getAnalysisDetail(mockSupabase, testAnalysisId, testUserId);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.error.code).toBe(AnalysisErrorCode.ANALYSIS_NOT_FOUND);
    }
  });

  test('다른 사용자의 분석 조회 시 403 에러를 반환해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: {
        id: testAnalysisId,
        user_id: 'different-user-id',
        birth_date: '1990-01-01',
        result: {
          basic: {},
          personality: {},
          fortune: {},
          advice: {},
        },
        created_at: '2025-10-29T10:00:00Z',
      },
      error: null,
    });

    // Act
    const result = await getAnalysisDetail(mockSupabase, testAnalysisId, testUserId);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error.code).toBe(AnalysisErrorCode.ANALYSIS_FORBIDDEN);
    }
  });

  test('JSONB 파싱 실패 시 500 에러를 반환해야 한다', async () => {
    // Arrange
    (mockSupabase.single as jest.Mock).mockResolvedValue({
      data: {
        id: testAnalysisId,
        user_id: testUserId,
        birth_date: '1990-01-01',
        result: {
          // 잘못된 구조 - basic, personality, fortune, advice 필드 누락
          invalid: 'data',
        },
        created_at: '2025-10-29T10:00:00Z',
      },
      error: null,
    });

    // Act
    const result = await getAnalysisDetail(mockSupabase, testAnalysisId, testUserId);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.code).toBe(AnalysisErrorCode.ANALYSIS_DATA_CORRUPTED);
    }
  });
});
