import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': resolve(import.meta.dirname, './src'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: false,
        setupFiles: ['./src/test/setup.ts'],
        testTimeout: 20000,
        hookTimeout: 20000,
        include: [
            'src/app/**/*.{test,spec}.{ts,tsx}',
            'src/admin/**/*.{test,spec}.{ts,tsx}',
            'src/components/**/*.{test,spec}.{ts,tsx}',
            'src/hooks/**/*.{test,spec}.{ts,tsx}',
            'src/lib/**/*.{test,spec}.{ts,tsx}',
            'src/screens/**/*.{test,spec}.{ts,tsx}',
            'src/test/**/*.{test,spec}.{ts,tsx}',
            'src/types/**/*.{test,spec}.{ts,tsx}',
            'src/utils/**/*.{test,spec}.{ts,tsx}',
        ],
        css: false,
    },
});
