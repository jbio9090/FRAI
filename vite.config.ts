import fs from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig, loadEnv } from 'vite';

/**
 * Herd/Valet serve the app over HTTPS, so Vite's HMR WebSocket must also
 * use TLS (wss) — otherwise the browser handshake fails with a 400
 * ("Unexpected response code") and hot reload dies. Point Vite at the
 * matching local certificate for APP_URL's host so dev HMR works over
 * `https://gso.test`. If no certificate exists (no Herd/Valet), fall back
 * to plain HTTP dev with no detectTls.
 *
 * TLS is now opt-in via VITE_HMR_TLS=true (default: false) to avoid
 * WebSocket failures on machines with certs that browsers don't trust.
 */
function resolveTlsHost(env: Record<string, string>): string | undefined {
    if (!env.APP_URL) return undefined;
    let host = '';
    try {
        host = new URL(env.APP_URL).hostname;
    } catch {
        return undefined;
    }
    if (!host) return undefined;

    const certDirs = [
        path.join(homedir(), '.config', 'herd', 'config', 'valet', 'Certificates'),
        path.join(homedir(), 'Library', 'Application Support', 'Herd', 'config', 'valet', 'Certificates'),
        path.join(homedir(), '.config', 'valet', 'Certificates'),
    ];
    const hasCert = certDirs.some((dir) => fs.existsSync(path.join(dir, `${host}.crt`)));
    return hasCert ? host : undefined;
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const detectTls = resolveTlsHost(env);
    const hmrTls = env.VITE_HMR_TLS === 'true' && detectTls;

    return {
        plugins: [
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.tsx'],
                ssr: 'resources/js/ssr.tsx',
                refresh: true,
                detectTls: hmrTls,
            }),
            react({
                babel: {
                    plugins: ['babel-plugin-react-compiler'],
                },
            }),
            tailwindcss(),
            wayfinder({
                formVariants: true,
            }),
        ],
        esbuild: {
            jsx: 'automatic',
        },
        resolve: {
            alias: {
                'ziggy-js': path.resolve('vendor/tightenco/ziggy'),
                react: path.resolve(__dirname, 'node_modules/react'),
                'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
            },
        },
    };
});