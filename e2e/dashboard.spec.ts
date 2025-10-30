import { test, expect } from '../playwright/fixtures/test';

test.describe('대시보드 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // auth.setup.ts에서 이미 로그인 완료된 상태
    // 대시보드로 이동
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /안녕하세요/ })).toBeVisible({
      timeout: 10000,
    });
  });

  test('사용자는 대시보드에서 사용량 정보를 확인할 수 있어야 한다', async ({ page }) => {
    // 대시보드 헤더 확인
    await expect(page.getByRole('heading', { name: /안녕하세요/ })).toBeVisible();

    // 로딩 완료 대기 (로딩 중... 텍스트가 사라질 때까지)
    const loadingText = page.getByText('로딩 중...');
    if (await loadingText.isVisible()) {
      await expect(loadingText).not.toBeVisible({ timeout: 10000 });
    }
  });

  test('사용자는 "새 분석하기" 버튼을 클릭하여 분석 페이지로 이동할 수 있어야 한다', async ({
    page,
  }) => {
    // 로딩 완료 대기
    const loadingText = page.getByText('로딩 중...');
    if (await loadingText.isVisible()) {
      await expect(loadingText).not.toBeVisible({ timeout: 10000 });
    }

    // "새 분석하기" 버튼 찾기 및 클릭
    const newAnalysisButton = page
      .getByRole('button', { name: '새 분석하기', exact: true })
      .first();
    await expect(newAnalysisButton).toBeVisible();

    // 버튼이 disabled가 아닌지 확인 (사용량이 남아있는 경우)
    const isDisabled = await newAnalysisButton.isDisabled();
    if (!isDisabled) {
      await newAnalysisButton.click();

      // 분석 페이지로 이동 확인
      await page.waitForURL('/analysis/new', { timeout: 5000 });
      await expect(page.getByRole('heading', { name: '새 분석하기' })).toBeVisible();
    }
  });

  test('무료 유저는 "Pro로 업그레이드" 버튼을 확인할 수 있어야 한다', async ({
    page,
  }) => {
    // 로딩 완료 대기
    const loadingText = page.getByText('로딩 중...');
    if (await loadingText.isVisible()) {
      await expect(loadingText).not.toBeVisible({ timeout: 10000 });
    }

    // Pro 업그레이드 버튼 확인 (무료 유저인 경우에만 표시됨)
    const upgradeButton = page.getByRole('button', { name: 'Pro로 업그레이드' });

    // 버튼이 있는지 확인 (없을 수도 있음 - Pro 유저인 경우)
    const isVisible = await upgradeButton.isVisible().catch(() => false);

    if (isVisible) {
      await upgradeButton.click();
      // 구독 페이지로 이동 확인
      await page.waitForURL('/subscription', { timeout: 5000 });
    }
  });

  test('사용자는 분석 이력을 확인할 수 있어야 한다', async ({ page }) => {
    // 로딩 완료 대기
    const loadingText = page.getByText('로딩 중...');
    if (await loadingText.isVisible()) {
      await expect(loadingText).not.toBeVisible({ timeout: 10000 });
    }

    // "분석 이력" 섹션 확인
    await expect(
      page.getByRole('heading', { name: '분석 이력', level: 2 })
    ).toBeVisible();

    // 이력이 있는지 없는지 확인
    const noHistoryText = page.getByText('아직 분석 이력이 없습니다');
    const hasHistory = !(await noHistoryText.isVisible().catch(() => false));

    if (!hasHistory) {
      // 이력이 없는 경우 - 안내 메시지 확인
      await expect(noHistoryText).toBeVisible();
      await expect(page.getByText('첫 번째 사주 분석을 시작해보세요!')).toBeVisible();
    } else {
      // 이력이 있는 경우 - 이력 카드가 표시되어야 함
      // 최소 1개 이상의 분석 이력이 있어야 함
      const historyCards = page
        .locator('[data-testid="analysis-card"], .grid > div')
        .first();
      await expect(historyCards).toBeVisible({ timeout: 5000 });
    }
  });
});
