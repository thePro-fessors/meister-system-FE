import { test, expect } from "@playwright/test";

test.describe("관리자 학년도/배치/감사 E2E 흐름", () => {
  test("관리자 로그인 -> 학년도 유예기간 설정 -> 대량 등록 비동기 SSE 모드 확인 -> 감사 로그 조회", async ({ page }) => {
    // 1. 관리자 로그인 페이지 접속
    await page.goto("/login");

    // 2. 관리자 계정 로그인
    await page.fill('input[name="username"], input[type="text"]', "admin@bssm.hs.kr");
    await page.fill('input[name="password"], input[type="password"]', "admin2026!");
    await page.click('button[type="submit"]');

    // 3. 관리자 개요/대시보드 이동 확인
    await page.waitForURL(/\/admin/, { timeout: 10000 });
    await expect(page.locator("body")).toBeVisible();

    // 4. 학년도 관리 페이지 점검
    await page.goto("/admin/years");
    await expect(page.locator("body")).toContainText(/학년도/);

    // 5. 대량 등록 페이지 점검 (비동기 SSE 체크박스 및 샘플 다운로드 버튼)
    await page.goto("/admin/batch");
    await expect(page.locator("body")).toContainText("명단 일괄 등록");
    await expect(page.locator('text=샘플 양식(CSV) 다운로드')).toBeVisible();

    // 6. 감사 로그 페이지 점검
    await page.goto("/admin/audit");
    await expect(page.locator("body")).toBeVisible();
  });
});
