import { test as setup, expect } from '../playwright/fixtures/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

// 디렉토리가 없으면 생성
const authDir = path.dirname(authFile);
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

setup('authenticate', async ({ page }) => {
  // 1. 로그인 페이지로 이동
  await page.goto('/sign-in');

  // 2. Clerk 폼이 로드될 때까지 대기
  await page.waitForSelector('input[name="identifier"]', {
    state: 'visible',
    timeout: 15000,
  });

  // 3. 이메일 입력
  await page.locator('input[name="identifier"]').fill(process.env.E2E_TEST_EMAIL!);

  // 4. Continue 동작 (우선 입력창에서 Enter를 눌러 제출)
  const continueButton = page
    .locator('button[type="submit"]:not([aria-hidden="true"])')
    .first();
  const canClickContinue = await continueButton.isVisible().catch(() => false);

  if (canClickContinue) {
    await continueButton.click({ timeout: 3000 }).catch(async () => {
      await page.locator('input[name="identifier"]').press('Enter');
    });
  } else {
    await page.locator('input[name="identifier"]').press('Enter');
  }

  // 5. 비밀번호 입력 필드가 나타날 때까지 대기
  await page.waitForSelector('input[name="password"]', {
    state: 'visible',
    timeout: 10000,
  });

  // 6. 비밀번호 입력
  await page.locator('input[name="password"]').fill(process.env.E2E_TEST_PASSWORD!);

  // 7. 로그인 제출 (Enter 키를 기본으로 사용, 버튼이 보이면 클릭)
  const loginButton = page
    .locator('button[type="submit"]:not([aria-hidden="true"])')
    .first();
  const canClickLogin = await loginButton.isVisible().catch(() => false);

  if (canClickLogin) {
    await loginButton.click({ timeout: 3000 }).catch(async () => {
      await page.locator('input[name="password"]').press('Enter');
    });
  } else {
    await page.locator('input[name="password"]').press('Enter');
  }

  // 8. 대시보드 페이지로 리디렉션 대기
  await page.waitForURL('/dashboard', { timeout: 15000 });

  // 9. 로그인 성공 확인
  await expect(page.getByRole('heading', { name: /안녕하세요/ })).toBeVisible({
    timeout: 10000,
  });

  // 10. 인증 상태 저장
  await page.context().storageState({ path: authFile });

  console.log('✅ 로그인 상태 저장 완료:', authFile);
});
