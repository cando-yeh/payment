/**
 * Vite 打包工具設定檔
 * 職責：配置開發伺服器插件（如 Svelte、TailwindCSS）以及專案編譯流程。
 */
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [tailwindcss(), sveltekit()] });
