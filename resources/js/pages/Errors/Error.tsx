import { Head, Link, usePage } from '@inertiajs/react';
import { FileSearch, ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { SharedData } from '@/types';

interface ErrorPageProps {
    status: number;
}

const ERROR_COPY = {
    403: {
        eyebrow: 'Access restricted',
        heading: '403',
        body: "You don't have permission to view this page.",
        Icon: ShieldAlert,
    },
    404: {
        eyebrow: 'Page not found',
        heading: '404',
        body: "The page you're looking for doesn't exist or may have moved.",
        Icon: FileSearch,
    },
} as const;

// Fallback for future codes (e.g. 419, 500, 503) until their copy is added.
const FALLBACK_COPY = {
    eyebrow: 'Something went wrong',
    heading: 'Error',
    body: 'An unexpected error occurred. Please try again or return to the dashboard.',
    Icon: FileSearch,
} as const;

export default function Error({ status }: ErrorPageProps) {
    useEffect(() => {
        const applyTheme = () => {
            const theme = localStorage.getItem('theme');
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const isDark = theme === 'dark' || (!theme && systemPrefersDark);
            document.documentElement.classList.toggle('dark', isDark);
        };

        applyTheme();

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (!localStorage.getItem('theme')) applyTheme();
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const copy = ERROR_COPY[status as keyof typeof ERROR_COPY] ?? { ...FALLBACK_COPY, heading: String(status) };
    const { Icon } = copy;

    // Note: `auth` is only present when the `web` middleware ran before the
    // error (e.g. a 403 inside the app). Genuine 404s match no route, so the
    // page renders with just `status` — fall back to the login link there.
    const { auth } = usePage<SharedData>().props;
    const isAuthenticated = auth?.user != null;

    const handleGoBack = () => {
        window.history.back();
    };

    return (
        <>
            <Head title={`${copy.heading} — ${copy.eyebrow}`} />
            <div className="flex min-h-svh items-center justify-center bg-background p-4 md:p-6">
                <main className="ads-card motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 w-full max-w-md p-6 text-center shadow-none md:p-8">
                    <div className="flex flex-col items-center gap-5">
                        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                            <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                            <p className="ads-eyebrow">{copy.eyebrow}</p>
                            <h1 className="font-display text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
                                {copy.heading}
                            </h1>
                            <p className="text-sm text-muted-foreground">{copy.body}</p>
                        </div>
                        <div className="flex flex-col items-center gap-2 sm:flex-row">
                            <Button asChild>
                                {isAuthenticated ? (
                                    <Link href={route('dashboard')}>Back to dashboard</Link>
                                ) : (
                                    <Link href={route('login.show')}>Back to login</Link>
                                )}
                            </Button>
                            <Button variant="ghost" type="button" onClick={handleGoBack}>
                                Go back
                            </Button>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
