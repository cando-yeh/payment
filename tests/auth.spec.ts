/**
 * 認證流程端對端測試 (End-to-End Test)
 * 
 * 職責：
 * 1. 模擬真實使用者開啟瀏覽器的行為。
 * 2. 驗證認證頁面的 UI 元素是否存在。
 * 3. 確保 Google 登入入口點已正確渲染。
 * 
 * 備註：
 * 真正的 OAuth 登入流程通常難以在 E2E 中完全模擬（因為 Google 的防機器人機制），
 * 所以此測試重於「冒煙測試」，即驗證登入介面本身的功能性。
 */
import { test, expect } from '@playwright/test';

test('認證頁面應正確顯示登入按鈕與品牌資訊', async ({ page }) => {
    // 1. 前往認證頁面（未登入時 / 會重導向至 /auth）
    await page.goto('/auth');

    // 2. 驗證品牌標題
    await expect(page.locator('text=報銷系統')).toBeVisible();

    // 3. 驗證關鍵 UI 組件
    const loginButton = page.locator('button:has-text("使用 Google 帳號登入")');
    await expect(loginButton).toBeVisible();

    // 4. 驗證歡迎文字
    await expect(page.locator('text=歡迎回來')).toBeVisible();
});
