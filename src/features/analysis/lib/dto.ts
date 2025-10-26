export type { Analysis, AnalysisHistoryResponse, AnalysisDetailResponse } from '../backend/schema';

// backend/schema에서 정의한 타입을 프론트엔드에서 재사용
export type { Analysis as AnalysisDetail, AnalysisResult } from '../backend/schema';
