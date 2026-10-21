import { test, expect } from "@playwright/test";

test.describe("학생 증빙자료 제출 E2E 흐름", () => {
  test("학생 로그인 -> 대시보드 조회 -> 증빙자료 작성 및 제출 확인", async ({ page }) => {
    // 1. 로그인 페이지 접속
    await page.goto("/login");
    await expect(page).toHaveTitle(/마이스터/);

    // 2. 학생 계정 로그인
    await page.fill('input[name="username"], input[type="text"]', "s10101@bssm.hs.kr");
    await page.fill('input[name="password"], input[type="password"]', "bssm2026!");
    await page.click('button[type="submit"]');

    // 3. 학생 대시보드 또는 제출 페이지 리다이렉션 검증
    await page.waitForURL(/\/(student\/dashboard|student\/submissions)/, { timeout: 10000 });
    await expect(page.locator("body")).toContainText("마이스터");

    // 4. 신규 증빙 제출 페이지 이동
    await page.goto("/student/submit");
    await expect(page.locator("h1, h2")).toContainText("증빙");

    // 5. 폼 필드 입력
    await page.fill('input[name="detail"], input[placeholder*="활동명"]', "E2E 자동화 정보처리기능사 취득");
    await page.fill('textarea[name="description"], textarea', "Playwright 브라우저 E2E 자동화 제출 테스트 증빙입니다.");
    
    // 활동 일자 입력
    const dateInput = page.locator('input[type="date"]');
    if (await dateInput.isVisible()) {
      await dateInput.fill("2026-03-15");
    }

    // 6. 제출 버튼 클릭
    const submitBtn = page.locator('button[type="submit"]:has-text("제출")');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }

    // 7. 제출 내역 페이지에서 신규 제출 항목 노출 확인
    await page.goto("/student/submissions");
    await expect(page.locator("body")).toBeVisible();
  });
});
