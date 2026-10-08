import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Deliberately separate from vite.config.ts: that file resolves Herd/Valet TLS
 * certificates and loads laravel-vite-plugin, neither of which belong in a test
 * run. Keep this config self-contained.
 */
export default defineConfig({
    plugins: [react()],
    esbuild: {
        jsx: 'automatic',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './resources/js'),
            'ziggy-js': path.resolve(__dirname, './node_modules/ziggy-js'),
            react: path.resolve(__dirname, './node_modules/react'),
            'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: false,
        setupFiles: ['./resources/js/test/setup.ts'],
        include: ['resources/js/**/*.test.{ts,tsx}'],
        restoreMocks: true,
    },
});