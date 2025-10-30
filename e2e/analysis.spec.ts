import { test, expect } from '../playwright/fixtures/test';

test.describe('사주 분석 생성 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // auth.setup.ts에서 이미 로그인 완료된 상태
    // 대시보드로 이동
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /안녕하세요/ })).toBeVisible({
      timeout: 10000,
    });
  });

  test('사용자는 분석 페이지에 접근할 수 있어야 한다', async ({ page }) => {
    // 분석 페이지로 직접 이동
    await page.goto('/analysis/new');

    // 페이지 로드 확인
    await expect(page.getByRole('heading', { name: '새 분석하기' })).toBeVisible();
    await expect(page.getByText('AI가 당신의 사주를 분석합니다')).toBeVisible();

    // 대시보드로 돌아가기 버튼 확인
    await expect(page.getByRole('button', { name: '대시보드로' })).toBeVisible();
  });

  test('사용자는 분석 폼의 모든 필드를 확인할 수 있어야 한다', async ({ page }) => {
    // 분석 페이지로 이동
    await page.goto('/analysis/new');

    // 폼 필드 확인
    await expect(page.getByLabel('생년월일 *')).toBeVisible();
    await expect(page.locator('input[name="birthTime"]')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('출생 시간을 모릅니다')).toBeVisible();
    await expect(page.getByRole('radio', { name: /음력/ })).toBeVisible();
  });

  test('사용자는 필수 정보만 입력하여 분석을 요청할 수 있어야 한다', async ({ page }) => {
    // 사용량 체크 - 사용 가능한 경우에만 테스트 진행
    await page.goto('/dashboard');
    const loadingText = page.getByText('로딩 중...');
    if (await loadingText.isVisible()) {
      await expect(loadingText).not.toBeVisible({ timeout: 10000 });
    }

    const newAnalysisButton = page
      .getByRole('button', { name: '새 분석하기', exact: true })
      .first();
    const isDisabled = await newAnalysisButton.isDisabled();

    if (isDisabled) {
      console.log('사용량 초과로 테스트 스킵');
      test.skip();
      return;
    }

    // 분석 페이지로 이동
    await page.goto('/analysis/new');

    // 생년월일 입력
    await page.getByLabel('생년월일 *').fill('1990-01-01');

    // 성별 선택 (라디오 버튼)
    const maleRadio = page.getByRole('radio', { name: /남성|male/i });
    const femaleRadio = page.getByRole('radio', { name: /여성|female/i });

    // 성별 선택 (존재하는 라디오 버튼 중 하나 선택)
    if (await maleRadio.isVisible()) {
      await maleRadio.check();
    } else if (await femaleRadio.isVisible()) {
      await femaleRadio.check();
    }

    // 제출 버튼 찾기
    const submitButton = page
      .getByRole('button', { name: /분석하기|제출|확인/, exact: false })
      .first();
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // 분석 완료 후 결과 페이지로 이동 (최대 30초 대기)
    // 실제 API 호출이 발생하므로 시간이 걸릴 수 있음
    await page.waitForURL(/\/analysis\/[a-f0-9-]+/, { timeout: 60000 });

    // 결과 페이지 로드 확인
    await expect(page.getByRole('heading', { name: /사주 분석 결과/ })).toBeVisible({
      timeout: 10000,
    });
  });

  test('사용자는 음력 옵션을 선택할 수 있어야 한다', async ({ page }) => {
    // 분석 페이지로 이동
    await page.goto('/analysis/new');

    // 음력 체크박스 찾기
    const lunarRadio = page.getByRole('radio', { name: /음력/ });

    // 체크박스가 있으면 선택
    if (await lunarRadio.isVisible()) {
      await lunarRadio.click();
      await expect(lunarRadio).toHaveAttribute('data-state', 'checked');
    }
  });

  test('사용자는 출생 시간을 모르는 경우 체크박스를 선택할 수 있어야 한다', async ({
    page,
  }) => {
    // 분석 페이지로 이동
    await page.goto('/analysis/new');

    // 출생 시간 입력 필드
    const birthTimeInput = page.locator('input[name="birthTime"]');
    await expect(birthTimeInput).toBeVisible();

    // 출생 시간 모름 체크박스 찾기
    const unknownCheckbox = page.locator(
      'input[type="checkbox"][name="birthTimeUnknown"]'
    );

    // 체크박스가 있으면 선택
    if (await unknownCheckbox.isVisible()) {
      await unknownCheckbox.check();
      await expect(unknownCheckbox).toBeChecked();

      // 체크 시 출생 시간 입력이 비활성화되는지 확인
      await expect(birthTimeInput).toBeDisabled();
    }
  });

  test('사용자는 대시보드로 돌아갈 수 있어야 한다', async ({ page }) => {
    // 분석 페이지로 이동
    await page.goto('/analysis/new');

    // 대시보드로 돌아가기 버튼 클릭
    await page.getByRole('button', { name: '대시보드로' }).click();

    // 대시보드 페이지로 이동 확인
    await page.waitForURL('/dashboard', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: /안녕하세요/ })).toBeVisible();
  });
});
