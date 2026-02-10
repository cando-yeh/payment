/**
 * 基礎工具單元測試 (Vitest)
 *
 * 本檔案測試 utils.ts 中的實際工具函數，而非僅驗證測試環境。
 */
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

/**
 * cn() 函數測試
 */
describe('cn() - Tailwind Class Merge Utility', () => {
    it('應合併多個 class 字串', () => {
        const result = cn('p-4', 'text-red-500');
        expect(result).toBe('p-4 text-red-500');
    });

    it('應解決 Tailwind 衝突（後者覆蓋前者）', () => {
        const result = cn('p-4', 'p-2');
        expect(result).toBe('p-2');
    });

    it('應處理條件式 class（falsy 值被過濾）', () => {
        const isActive = false;
        const result = cn('base', isActive && 'active-class', 'another');
        expect(result).toBe('base another');
    });

    it('應處理空輸入', () => {
        const result = cn();
        expect(result).toBe('');
    });

    it('應處理 undefined 和 null 輸入', () => {
        const result = cn('base', undefined, null, 'end');
        expect(result).toBe('base end');
    });

    it('應處理物件式 class', () => {
        const result = cn({ 'bg-blue-500': true, 'text-white': true, 'hidden': false });
        expect(result).toContain('bg-blue-500');
        expect(result).toContain('text-white');
        expect(result).not.toContain('hidden');
    });

    it('應處理陣列式 class', () => {
        const result = cn(['p-4', 'mx-auto'], 'text-center');
        expect(result).toContain('p-4');
        expect(result).toContain('mx-auto');
        expect(result).toContain('text-center');
    });

    it('應正確解決複雜的 Tailwind 衝突', () => {
        // bg-red-500 與 bg-blue-500 衝突，後者勝出
        const result = cn('bg-red-500', 'bg-blue-500');
        expect(result).toBe('bg-blue-500');
    });

    it('應保留不衝突的 class', () => {
        const result = cn('p-4', 'mx-auto', 'text-center', 'bg-white');
        expect(result).toBe('p-4 mx-auto text-center bg-white');
    });
});

/**
 * 測試環境驗證（冒煙測試）
 */
describe('測試環境驗證 (Smoke Test)', () => {
    it('應能執行標準 JavaScript 運算', () => {
        expect(1 + 1).toBe(2);
    });

    it('應能處理模板字串', () => {
        const result = `${'Svelte'}${'Kit'}`;
        expect(result).toBe('SvelteKit');
    });

    it('應能正確處理物件深層比對', () => {
        const user = { name: 'Admin', role: 'finance' };
        expect(user).toEqual({ name: 'Admin', role: 'finance' });
    });
});
