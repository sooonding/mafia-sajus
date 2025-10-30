import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// .env.local 파일 로드
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// 인증 상태 파일 경로
const authFile = path.join(__dirname, 'playwright/.auth/user.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // Setup project - 로그인 상태 저장
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // 실제 테스트 프로젝트 - 저장된 로그인 상태 사용
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 파일이 존재할 때만 storageState 사용
        ...(fs.existsSync(authFile) ? { storageState: authFile } : {}),
      },
      dependencies: ['setup'],
    },
  ],
  // 테스트 실행 전 개발 서버를 시작하는 설정
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
