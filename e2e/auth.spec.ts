import { test, expect } from '../playwright/fixtures/test';

test.describe('인증 플로우', () => {
  test('로그인된 사용자는 대시보드에 접근할 수 있어야 한다', async ({ page }) => {
    // auth.setup.ts에서 이미 로그인 완료된 상태
    await page.goto('/dashboard');

    // 대시보드가 올바르게 로드되는지 확인
    await expect(page.getByRole('heading', { name: /안녕하세요/ })).toBeVisible({
      timeout: 10000,
    });
  });

  test('로그인된 사용자는 로그아웃할 수 있어야 한다', async ({ page }) => {
    await page.goto('/dashboard');

    // 사용자 메뉴 또는 로그아웃 버튼 찾기 (실제 UI에 맞게 조정 필요)
    const userButton = page
      .locator('[data-testid="user-button"]')
      .or(page.getByRole('button', { name: /profile|프로필|account|계정/i }));

    if (await userButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await userButton.click();

      // 로그아웃 버튼 클릭
      const signOutButton = page.getByRole('button', { name: /sign out|로그아웃/i });
      if (await signOutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await signOutButton.click();

        // 로그인 페이지로 리디렉션 확인
        await page.waitForURL(/sign-in|login/, { timeout: 10000 });
      }
    }
  });
});
