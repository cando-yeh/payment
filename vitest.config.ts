/**
 * Vitest 單元測試設定檔
 * 職責：配置單元測試環境、Svelte 元件測試插件及 jsdom 模擬瀏覽器。
 */
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
    plugins: [sveltekit()],
    test: {
        include: ['src/**/*.{test,spec}.{js,ts}'],
        environment: 'jsdom',
        globals: true
    }
});
