/**
 * 認證流程端對端測試 (End-to-End Test)
 * 
 * 職責：
 * 1. 模擬真實使用者開啟瀏覽器的行為。
 * 2. 驗證應用程式的首頁 UI 元素是否存在且標題正確。
 * 3. 確保 Google 登入入口點已正確渲染。
 * 
 * 備註：
 * 真正的 OAuth 登入流程通常難以在 E2E 中完全模擬（因為 Google 的防機器人機制），
 * 所以此測試重於「冒煙測試」，即驗證登入介面本身的功能性。
 */
import { test, expect } from '@playwright/test';

test('首頁應正確顯示標題與登入按鈕', async ({ page }) => {
    // 1. 前往應用程式根目錄
    await page.goto('/');

    // 2. 驗證 HTML 標題是否符合預期
    // 檢查 <title> 標籤內是否包含「請款系統」字樣
    await expect(page).toHaveTitle(/請款系統/);

    // 3. 驗證關鍵 UI 組件
    // 使用 locator 尋找包含特定文字的按鈕元件
    const loginButton = page.locator('button:has-text("使用 Google 帳號登入")');

    // 斷言該按鍵在畫面上是可見的
    await expect(loginButton).toBeVisible();
});
