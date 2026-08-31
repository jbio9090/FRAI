import { usePage } from '@inertiajs/react';
import { Link } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { AppSidebar } from '@/components/app-sidebar';
import ThemeToggle from '@/components/theme-toggle';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';

interface DashboardProps {
    children: React.ReactNode;
    labeledBreadcrumb?: string | null;
    hasPadding?: boolean;
}

interface PageProps {
    breadcrumbs: string[];
    labeledBreadcrumb: string;
    auth?: {
        user?: {
            notification_unread_count?: number;
        };
    };
}

/**
 * Reads the sidebar open/closed preference that shadcn persists in a cookie.
 * Falls back to `true` (expanded) on first visit or when the cookie is absent.
 */
function getSidebarDefaultOpen(): boolean {
    if (typeof document === 'undefined') return true;
    const match = document.cookie.split('; ').find((row) => row.startsWith('sidebar_state='));
    if (!match) return true;
    return match.split('=')[1] === 'true';
}

export default function DefaultLayout({ children, hasPadding = true }: DashboardProps) {
    const page = usePage<PageProps>();
    const breadcrumbs = page.props.breadcrumbs;
    const labeledBreadcrumb = page.props.labeledBreadcrumb;
    const flash = (page.props as any).flash as { success?: string; error?: string } | undefined;

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

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

    return (
        /*
         * `defaultOpen` is seeded from the cookie so the sidebar remembers its
         * collapsed/expanded state across page navigations.
         *
         * On mobile the Sidebar component renders a Sheet overlay regardless of
         * this value — the icon-rail collapse only applies at ≥ md breakpoint.
         */
        <SidebarProvider defaultOpen={getSidebarDefaultOpen()} className="bg-background">
            <AppSidebar />
            <SidebarInset className="relative min-h-svh">
                <header className="sticky top-0 z-8 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

                    <Breadcrumb>
                        <BreadcrumbList>
                            {breadcrumbs &&
                                breadcrumbs.map((breadcrumb, index) => {
                                    const path = '/' + breadcrumbs.slice(0, index + 1).join('/');
                                    const isLast = index === breadcrumbs.length - 1;

                                    return (
                                        <React.Fragment key={breadcrumb + index}>
                                            <BreadcrumbItem>
                                                {isLast && labeledBreadcrumb == null ? (
                                                    <BreadcrumbPage>{breadcrumb.charAt(0).toUpperCase() + breadcrumb.slice(1)}</BreadcrumbPage>
                                                ) : (
                                                    <BreadcrumbLink href={path}>
                                                        {breadcrumb.charAt(0).toUpperCase() + breadcrumb.slice(1)}
                                                    </BreadcrumbLink>
                                                )}
                                            </BreadcrumbItem>
                                            {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                                        </React.Fragment>
                                    );
                                })}

                            {labeledBreadcrumb && (
                                <React.Fragment key={labeledBreadcrumb}>
                                    {breadcrumbs.length > 0 && <BreadcrumbSeparator />}
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>{labeledBreadcrumb}</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </React.Fragment>
                            )}
                        </BreadcrumbList>
                    </Breadcrumb>

                    <div className="ml-auto flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="relative size-9 rounded-md text-muted-foreground"
                            aria-label="Notifications"
                            asChild
                        >
                            <Link href={route('dashboard', { tab: 'inbox' })}>
                                <Bell className="h-4 w-4" />
                                {(page.props.auth?.user?.notification_unread_count ?? 0) > 0 && (
                                    <span className="absolute top-2 right-2 size-2 rounded-full bg-[var(--primary)]" />
                                )}
                            </Link>
                        </Button>
                        <ThemeToggle />
                    </div>
                </header>

                <div
                    className={
                        'mx-auto flex w-full max-w-10xl flex-1 flex-col justify-start gap-4 overflow-visible' + (hasPadding ? ' p-6 md:p-8' : '')
                    }
                >
                    {children}
                </div>

                <Toaster
                    toastOptions={{
                        classNames: {
                            toast: 'group toast',
                            description: 'group-[.toast]:text-foreground',
                            title: 'font-bold',
                        },
                    }}
                    position="top-right"
                />
            </SidebarInset>
        </SidebarProvider>
    );
}
