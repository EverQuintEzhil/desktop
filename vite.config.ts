import { resolve } from 'path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

// Tauri dev-server settings merged with the FluentMind app config (mirrors frontend/app/vite.common.ts).
export default defineConfig({
    plugins: [react(), tailwindcss()],
    define: {
        global: 'globalThis',
    },
    // prevent Vite from obscuring rust errors
    clearScreen: false,
    // tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                  protocol: 'ws',
                  host,
                  port: 1421,
              }
            : undefined,
        watch: {
            // tell Vite to ignore watching `src-tauri`
            ignored: ['**/src-tauri/**'],
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                loadPaths: [resolve(import.meta.dirname, 'src/styles')],
                additionalData: `@use 'breakpoints' as *;\n@use 'mixins' as *;\n`,
            },
        },
    },
    resolve: {
        alias: {
            '@': resolve(import.meta.dirname, './src'),
        },
    },
});
