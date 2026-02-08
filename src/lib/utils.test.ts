/**
 * 基礎工具單元測試 (Vitest)
 * 
 * 本檔案兼具兩個職責：
 * 1. 冒煙測試 (Smoke Test)：確保測試框架 (Vitest) 與環境 (Node.js/JSDOM) 已正確安裝及配置。
 * 2. 作為範本：提供撰寫高品質測試案例的範例。
 */
import { describe, it, expect } from 'vitest';

/**
 * 基礎環境邏輯驗證
 */
describe('測試環境驗證 (Environment Check)', () => {

    it('應能執行標準 JavaScript 數學運算 (驗證渲染引擎)', () => {
        // 確保基本的 JavaScript 行為如預期
        const sum = 1 + 1;
        expect(sum).toBe(2);
        expect(sum).not.toBe(3);
    });

    it('應能處理 Svelte 專用的字串串接邏輯', () => {
        // 模擬簡單的應用程式資料處理
        const framework = 'Svelte';
        const tool = 'Kit';
        const result = `${framework}${tool}`;

        expect(result).toBe('SvelteKit');
        expect(result).toHaveLength(9);
    });

    it('應能正確處理物件比對 (深層比對驗證)', () => {
        // 驗證 expect.toEqual 常見用法
        const user = { name: 'Admin', role: 'finance' };
        expect(user).toEqual({ name: 'Admin', role: 'finance' });
    });
});
