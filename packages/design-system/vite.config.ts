import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const REACT_EXTERNALS = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'];

const APP_SRC = resolve(__dirname, '../../src');

export default defineConfig({
    resolve: {
        alias: {
            '@': APP_SRC,
        },
    },
    plugins: [react()],
    build: {
        lib: {
            entry: 'src/index.ts',
            formats: ['es'],
            fileName: () => 'index.js',
        },
        sourcemap: true,
        emptyOutDir: true,
        rollupOptions: {
            external: REACT_EXTERNALS,
            output: {
                codeSplitting: false,
            },
        },
    },
});
