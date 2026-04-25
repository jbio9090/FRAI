import { usePage } from '@inertiajs/react';
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AppSidebar } from "@/components/app-sidebar"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { toast } from 'sonner';

interface DashboardProps {
    children: React.ReactNode;
    labeledBreadcrumb?: string | null;
    hasPadding?: boolean;
}

interface PageProps {
    breadcrumbs: string[];
    labeledBreadcrumb: string;
}

const isMobile = () => window.innerWidth < 768;

export default function DefaultLayout({ children, hasPadding = true }: DashboardProps) {
    const page = usePage<PageProps>();
    const breadcrumbs = page.props.breadcrumbs;
    const labeledBreadcrumb = page.props.labeledBreadcrumb;
    const flash = (page.props as any).flash as { success?: string; error?: string } | undefined;

    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const lastScrollY = useRef(0);
    const ticking = useRef(false);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        const applyTheme = () => {
            const theme = localStorage.getItem("theme");
            const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

            const isDark = theme === "dark" || (!theme && systemPrefersDark);

            document.documentElement.classList.toggle("dark", isDark);
        };

        applyTheme();

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => {
            if (!localStorage.getItem("theme")) {
                applyTheme();
            }
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    useEffect(() => {
        const SCROLL_THRESHOLD = 8;

        const handleScroll = () => {
            if (!isMobile()) {
                setIsHeaderVisible(true);
                return;
            }

            if (ticking.current) return;

            ticking.current = true;
            requestAnimationFrame(() => {
                const currentScrollY = window.scrollY;
                const delta = currentScrollY - lastScrollY.current;

                if (Math.abs(delta) > SCROLL_THRESHOLD) {
                    if (delta > 0 && currentScrollY > 64) {
                        setIsHeaderVisible(false);
                    } else if (delta < 0) {
                        setIsHeaderVisible(true);
                    }
                    lastScrollY.current = currentScrollY;
                }

                ticking.current = false;
            });
        };

        const handleResize = () => {
            if (!isMobile()) setIsHeaderVisible(true);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <SidebarProvider className='pt-4 bg-sidebar'>
            <AppSidebar />
            <SidebarInset className='relative rounded-tl-2xl overflow-hidden border'>
                <motion.header
                    className="flex h-16 shrink-0 items-center gap-2 border-b px-4 top-0 right-0 fixed z-8 w-full md:static bg-background"
                    animate={{
                        y: isHeaderVisible ? 0 : -64,
                        opacity: isHeaderVisible ? 1 : 0,
                    }}
                    transition={{
                        y: {
                            type: 'spring',
                            stiffness: 300,
                            damping: 30,
                        },
                        opacity: {
                            duration: 0.2,
                            ease: 'easeInOut',
                        },
                    }}
                >
                    <SidebarTrigger className="-ml-1" />
                    <Separator
                        orientation="vertical"
                        className="mr-2 data-[orientation=vertical]:h-4"
                    />

                    <Breadcrumb>
                        <BreadcrumbList>
                            {breadcrumbs && breadcrumbs.map((breadcrumb, index) => {
                                const path = '/' + breadcrumbs.slice(0, index + 1).join('/');
                                const isLast = index === breadcrumbs.length - 1;

                                return (
                                    <React.Fragment key={breadcrumb + index}>
                                        <BreadcrumbItem>
                                            {(isLast && labeledBreadcrumb == null) ? (
                                                <BreadcrumbPage>
                                                    {breadcrumb.charAt(0).toUpperCase() + breadcrumb.slice(1)}
                                                </BreadcrumbPage>
                                            ) : (
                                                <BreadcrumbLink href={path}>
                                                    {breadcrumb.charAt(0).toUpperCase() + breadcrumb.slice(1)}
                                                </BreadcrumbLink>
                                            )}
                                        </BreadcrumbItem>
                                        {index < breadcrumbs.length - 1 && (
                                            <BreadcrumbSeparator />
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {(labeledBreadcrumb) && (
                                <React.Fragment key={labeledBreadcrumb}>
                                    {(breadcrumbs.length > 0) && (
                                        <BreadcrumbSeparator />
                                    )}

                                    <BreadcrumbItem>
                                        <BreadcrumbPage>
                                            {labeledBreadcrumb}
                                        </BreadcrumbPage>
                                    </BreadcrumbItem>
                                </React.Fragment>
                            )}
                        </BreadcrumbList>
                    </Breadcrumb>
                </motion.header>

                <div className={"flex flex-1 flex-col gap-4 justify-start overflow-visible mt-16 md:mt-0 max-w-7xl mx-auto w-full " + ((hasPadding) ? " p-6 md:p-8" : "")}>
                    {children}
                </div>

                <Toaster
                    toastOptions={{
                        classNames: {
                            toast: "group toast",
                            description: "group-[.toast]:text-foreground",
                            title: "font-bold",
                        }
                    }}
                    position='top-right'
                />
            </SidebarInset>
        </SidebarProvider>
    )
}