import laravel from 'laravel-vite-plugin';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs';
import { homedir } from 'node:os';

const fallbackDomain = 'plv-gso-github.test';

function getEnvValue(env: Record<string, string | undefined>, key: string): string {
    return (env[key] ?? process.env[key] ?? '').trim();
}

function resolveCaseInsensitive(filePath: string): string | undefined {
    if (fs.existsSync(filePath)) {
        return filePath;
    }

    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return undefined;
    }

    const match = entries.find((entry) => entry.toLowerCase() === base.toLowerCase());
    return match ? path.join(dir, match) : undefined;
}

function resolveCertPair(certPath: string | undefined, keyPath: string | undefined): { cert: Buffer; key: Buffer } | undefined {
    if (!certPath || !keyPath) {
        return undefined;
    }

    const cert = resolveCaseInsensitive(certPath);
    const key = resolveCaseInsensitive(keyPath);
    if (!cert || !key) {
        return undefined;
    }

    try {
        return { cert: fs.readFileSync(cert), key: fs.readFileSync(key) };
    } catch {
        return undefined;
    }
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const devHost = getEnvValue(env, 'VITE_DEV_HOST') || fallbackDomain;
    const domains = devHost === fallbackDomain ? [devHost] : [devHost, fallbackDomain];

    const explicitCert = getEnvValue(env, 'VITE_DEV_CERT');
    const explicitKey = getEnvValue(env, 'VITE_DEV_CERT_KEY');
    let https = resolveCertPair(explicitCert || undefined, explicitKey || undefined);

    if (!https) {
        const home = homedir();
        for (const domain of domains) {
            https =
                resolveCertPair(
                    path.join(home, '.config', 'herd', 'config', 'valet', 'Certificates', `${domain}.crt`),
                    path.join(home, '.config', 'herd', 'config', 'valet', 'Certificates', `${domain}.key`),
                ) ??
                resolveCertPair(
                    path.join(home, '.config', 'herd', 'certs', `${domain}.crt`),
                    path.join(home, '.config', 'herd', 'certs', `${domain}.key`),
                );
            if (https) {
                break;
            }
        }
    }

    const hmrTls = getEnvValue(env, 'VITE_HMR_TLS').toLowerCase();
    const hmrProtocol = hmrTls === 'true' ? 'wss' : hmrTls === 'false' ? 'ws' : https ? 'wss' : 'ws';
    const port = Number(getEnvValue(env, 'VITE_DEV_PORT')) || 5173;

    return {
        plugins: [
            laravel({
                input: ['resources/js/app.tsx'],
                refresh: true,
            }),
            react(),
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
            port,
            hmr: {
                host: devHost,
                protocol: hmrProtocol,
            },
            https: https ?? undefined,
        },
    };
});
