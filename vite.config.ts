import laravel from 'laravel-vite-plugin';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import fs from 'node:fs';
import { homedir } from 'node:os';

const herdDomain = 'gso.test';
const herdCertPath = path.join(homedir(), '.config', 'herd', 'certs', `${herdDomain}.crt`);
const herdKeyPath = path.join(homedir(), '.config', 'herd', 'certs', `${herdDomain}.key`);

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/app.tsx'],
            refresh: true,
        }),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
    ],
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
    server: {
        host: '0.0.0.0',
        port: 5173,
        hmr: {
            host: herdDomain,
            protocol: 'wss',
        },
        https: fs.existsSync(herdCertPath) && fs.existsSync(herdKeyPath)
            ? {
                cert: fs.readFileSync(herdCertPath),
                key: fs.readFileSync(herdKeyPath),
            }
            : undefined,
    },
});
