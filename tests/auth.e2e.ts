/**
 * 認證流程端對端測試 (E2E)
 * 測試目標：驗證入口網頁的基本 UI 元件與標題是否正確顯示。
 */
import { test, expect } from '@playwright/test';

test('首頁應正確顯示標題與登入按鈕', async ({ page }) => {
    // 1. 前往首頁
    await page.goto('/');

    // 2. 檢查標題是否包含「請款系統」 (驗證 HTML <title>)
    await expect(page).toHaveTitle(/請款系統/);

    // 3. 檢查 Google 登入按鈕是否出現在畫面上
    const loginButton = page.locator('button:has-text("使用 Google 帳號登入")');
    await expect(loginButton).toBeVisible();
});
