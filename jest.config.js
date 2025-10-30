const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  // 커버리지 설정 (테스트가 작성된 파일만 포함)
  collectCoverageFrom: [
    'src/backend/integrations/**/*.ts',
    'src/backend/services/**/*.ts',
    'src/features/analysis/backend/service.ts',
    'src/features/subscription/backend/service.ts',
    'src/lib/utils/date.ts',
    // 제외 패턴
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/e2e/',
    '/coverage/',
  ],
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 60,
      lines: 70,
      statements: 70,
    },
    // 외부 API 통합: 100% (달성)
    './src/backend/integrations/gemini/client.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './src/backend/integrations/tosspayments/client.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    // 사용량 관리 서비스: 80% 이상
    './src/backend/services/usage.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
