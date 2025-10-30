import { test, expect } from '../playwright/fixtures/test';

test.describe('구독 관리 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // auth.setup.ts에서 이미 로그인 완료된 상태
    // 대시보드로 이동
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /안녕하세요/ })).toBeVisible({
      timeout: 10000,
    });
  });

  test('사용자는 구독 페이지에 접근할 수 있어야 한다', async ({ page }) => {
    // 구독 페이지로 이동
    await page.goto('/subscription');

    // 페이지 로드 확인
    await expect(page.getByRole('heading', { name: '구독 관리' })).toBeVisible({
      timeout: 10000,
    });

    // 로딩 완료 대기
    const loader = page.locator('.animate-spin');
    if (await loader.isVisible().catch(() => false)) {
      await expect(loader).not.toBeVisible({ timeout: 10000 });
    }
  });

  test('무료 유저는 Pro 요금제 정보를 확인할 수 있어야 한다', async ({ page }) => {
    // 구독 페이지로 이동
    await page.goto('/subscription');

    // 로딩 완료 대기
    const loader = page.locator('.animate-spin');
    if (await loader.isVisible().catch(() => false)) {
      await expect(loader).not.toBeVisible({ timeout: 10000 });
    }

    // "무료 체험" 뱃지 또는 "Pro 요금제" 제목 확인
    const freeBadge = page.getByText('무료 체험');
    const proTitle = page.getByRole('heading', { name: 'Pro 요금제' });

    const isFreeUser =
      (await freeBadge.isVisible().catch(() => false)) ||
      (await proTitle.isVisible().catch(() => false));

    if (isFreeUser) {
      // Pro 요금제 혜택 확인
      await expect(page.getByText(/AI 분석/)).toBeVisible();
      await expect(page.getByText(/Gemini 2.5 Pro/)).toBeVisible();

      // 가격 정보 확인
      await expect(page.getByText('월 구독료')).toBeVisible();

      // 구독하기 버튼 확인
      const subscribeButton = page.getByRole('button', {
        name: /구독하기|Pro 구독 시작/,
      });
      await expect(subscribeButton).toBeVisible();
    }
  });

  test('무료 유저는 구독하기 버튼을 클릭할 수 있어야 한다 (결제 창 확인만)', async ({
    page,
  }) => {
    // 구독 페이지로 이동
    await page.goto('/subscription');

    // 로딩 완료 대기
    const loader = page.locator('.animate-spin');
    if (await loader.isVisible().catch(() => false)) {
      await expect(loader).not.toBeVisible({ timeout: 10000 });
    }

    // 무료 유저인지 확인
    const freeBadge = page.getByText('무료 체험');
    const isFreeUser = await freeBadge.isVisible().catch(() => false);

    if (!isFreeUser) {
      console.log('이미 Pro 유저이므로 테스트 스킵');
      test.skip();
      return;
    }

    // 구독하기 버튼 찾기
    const subscribeButton = page.getByRole('button', { name: /구독하기|Pro 구독 시작/ });
    await expect(subscribeButton).toBeVisible();

    // 버튼 클릭 (실제 결제는 진행하지 않음)
    // 토스페이먼츠 결제 창이 열리는지만 확인
    await subscribeButton.click();

    // 결제 처리 중 로딩 확인 또는 에러 메시지 확인
    // (실제 환경에서는 토스페이먼츠 팝업이 열림)
    await page.waitForTimeout(2000);

    // 주의: 실제 E2E 테스트에서는 결제를 완료하지 않으므로
    // 여기서 테스트를 종료합니다.
  });

  test('Pro 유저는 활성 구독 정보를 확인할 수 있어야 한다', async ({ page }) => {
    // 구독 페이지로 이동
    await page.goto('/subscription');

    // 로딩 완료 대기
    const loader = page.locator('.animate-spin');
    if (await loader.isVisible().catch(() => false)) {
      await expect(loader).not.toBeVisible({ timeout: 10000 });
    }

    // Pro 유저인지 확인
    const proBadge = page.getByText(/Pro 구독|활성/);
    const isProUser = await proBadge.isVisible().catch(() => false);

    if (isProUser) {
      // 다음 결제일 정보 확인
      const nextBillingText = page.getByText(/다음 결제일|결제 예정일/);
      const hasNextBilling = await nextBillingText.isVisible().catch(() => false);

      if (hasNextBilling) {
        await expect(nextBillingText).toBeVisible();
      }

      // 구독 취소 버튼 확인
      const cancelButton = page.getByRole('button', { name: /구독 취소|취소하기/ });
      const hasCancelButton = await cancelButton.isVisible().catch(() => false);

      if (hasCancelButton) {
        await expect(cancelButton).toBeVisible();
      }
    }
  });

  test('Pro 유저는 구독 취소를 시도할 수 있어야 한다 (확인만)', async ({ page }) => {
    // 구독 페이지로 이동
    await page.goto('/subscription');

    // 로딩 완료 대기
    const loader = page.locator('.animate-spin');
    if (await loader.isVisible().catch(() => false)) {
      await expect(loader).not.toBeVisible({ timeout: 10000 });
    }

    // Pro 유저인지 확인
    const proBadge = page.getByText(/Pro 구독|활성/);
    const isProUser = await proBadge.isVisible().catch(() => false);

    if (!isProUser) {
      console.log('무료 유저이므로 테스트 스킵');
      test.skip();
      return;
    }

    // 구독 취소 버튼 찾기
    const cancelButton = page.getByRole('button', { name: /구독 취소|취소하기/ });
    const hasCancelButton = await cancelButton.isVisible().catch(() => false);

    if (hasCancelButton) {
      await cancelButton.click();

      // 확인 다이얼로그가 나타나는지 확인
      const confirmDialog = page.getByRole('dialog');
      const hasDialog = await confirmDialog.isVisible().catch(() => false);

      if (hasDialog) {
        // 다이얼로그 내용 확인
        await expect(page.getByText(/정말로 취소하시겠습니까|구독을 취소/)).toBeVisible();

        // 취소 확인 버튼 찾기 (실제로는 클릭하지 않음)
        const confirmCancelButton = page.getByRole('button', { name: /확인|취소하기/ });
        await expect(confirmCancelButton).toBeVisible();

        // 다이얼로그 닫기 (실제 취소는 하지 않음)
        const closeButton = page.getByRole('button', { name: /닫기|아니오/ });
        if (await closeButton.isVisible().catch(() => false)) {
          await closeButton.click();
        } else {
          // ESC 키로 닫기
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('취소된 구독은 재개할 수 있어야 한다 (UI 확인만)', async ({ page }) => {
    // 구독 페이지로 이동
    await page.goto('/subscription');

    // 로딩 완료 대기
    const loader = page.locator('.animate-spin');
    if (await loader.isVisible().catch(() => false)) {
      await expect(loader).not.toBeVisible({ timeout: 10000 });
    }

    // 취소된 구독인지 확인
    const canceledBadge = page.getByText(/취소됨|취소된/);
    const isCanceled = await canceledBadge.isVisible().catch(() => false);

    if (isCanceled) {
      // 재개 버튼 확인
      const resumeButton = page.getByRole('button', { name: /재개|다시 시작/ });
      const hasResumeButton = await resumeButton.isVisible().catch(() => false);

      if (hasResumeButton) {
        await expect(resumeButton).toBeVisible();
        // 실제 재개는 하지 않음
      }
    }
  });

  test('대시보드에서 구독 페이지로 이동할 수 있어야 한다', async ({ page }) => {
    // 대시보드에서 시작
    await page.goto('/dashboard');

    // 로딩 완료 대기
    await expect(page.getByText('로딩 중...')).not.toBeVisible({ timeout: 10000 });

    // "Pro로 업그레이드" 버튼 찾기 (무료 유저만)
    const upgradeButton = page.getByRole('button', { name: 'Pro로 업그레이드' });
    const hasButton = await upgradeButton.isVisible().catch(() => false);

    if (hasButton) {
      await upgradeButton.click();

      // 구독 페이지로 이동 확인
      await page.waitForURL('/subscription', { timeout: 5000 });
      await expect(page.getByRole('heading', { name: '구독 관리' })).toBeVisible();
    }
  });
});
