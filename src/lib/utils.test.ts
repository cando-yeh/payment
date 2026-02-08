/**
 * 單元測試範例 (Unit Test Template)
 * 職責：作為測試撰寫範本，並用於驗證 Vitest 測試環境是否正常運作（冒煙測試）。
 */
import { describe, it, expect } from 'vitest';

describe('基礎環境測試', () => {
    it('應能執行基本的數學運算', () => {
        expect(1 + 1).toBe(2);
    });

    it('應能處理字串連線', () => {
        const str = 'Svelte' + 'Kit';
        expect(str).toBe('SvelteKit');
    });
});
