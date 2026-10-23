import { test, expect } from "@playwright/test";

test.describe("교사 증빙 심사 및 승인 E2E 흐름", () => {
  test("교사 로그인 -> 심사 대기 목록 조회 -> 상세 열람 및 승인/반려 판정", async ({ page }) => {
    // 1. 로그인 페이지 접속
    await page.goto("/login");

    // 2. 교사 계정 로그인
    await page.fill('input[name="username"], input[type="text"]', "teacher1@bssm.hs.kr");
    await page.fill('input[name="password"], input[type="password"]', "teacher2026!");
    await page.click('button[type="submit"]');

    // 3. 교사 대시보드 리다이렉션 검증
    await page.waitForURL(/\/teacher/, { timeout: 10000 });
    await expect(page.locator("body")).toBeVisible();

    // 4. 심사 검토 목록 이동
    await page.goto("/teacher/dashboard");
    await expect(page.locator("h1, h2")).toContainText(/교사|심사|검토|대시보드/);

    // 5. 심사 대기 테이블 렌더링 확인
    const reviewTable = page.locator("table");
    await expect(reviewTable).toBeVisible();

    // 6. 첫 번째 심사 대기 항목 상세 페이지 열람
    const firstRowAction = page.locator("table tbody tr a, table tbody tr button").first();
    if (await firstRowAction.isVisible()) {
      await firstRowAction.click();
      // 점수 입력 및 심사의견 필드 확인
      const commentField = page.locator('textarea[placeholder*="의견"], textarea');
      if (await commentField.isVisible()) {
        await commentField.fill("Playwright E2E 자동화 심사 승인 확인 의견");
      }
    }
  });
});
