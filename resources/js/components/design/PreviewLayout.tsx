import { Link, router, usePage } from '@inertiajs/react';
import {
    BookOpen,
    Box,
    Cable,
    Check,
    CheckLine,
    ChevronRight,
    ChevronsUpDown,
    CirclePlus,
    ClipboardList,
    FileClock,
    IterationCw,
    LayoutGrid,
    LogOut,
    MessagesSquare,
    Moon,
    PanelLeft,
    Settings,
    Sparkles,
    Sun,
    User,
    X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';
import ChatbotSessionModal from '@/components/ChatbotSessionModal';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermission } from '@/hooks/use-permission';
import getInitials from '@/lib/getInitials';
import { cn } from '@/lib/utils';
import logo from '@/svg/FRAI.svg';
import type { SharedData } from '@/types';

interface PreviewLayoutProps {
    children: React.ReactNode;
    crumb: string;
}

function useTheme() {
    const [dark, setDark] = useState(() => {
        if (typeof document === 'undefined') return false;
        const theme = localStorage.getItem('theme');
        return theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
    }, [dark]);

    const toggle = () => {
        const next = !dark;
        setDark(next);
        localStorage.setItem('theme', next ? 'dark' : 'light');
    };

    return { dark, toggle };
}

function NavItem({
    icon: Icon,
    label,
    active,
    href,
    badge,
    onClick,
    primary,
}: {
    icon: React.ElementType;
    label: string;
    active?: boolean;
    href?: string;
    badge?: React.ReactNode;
    onClick?: () => void;
    primary?: boolean;
}) {
    const inner = (
        <>
            <span className="relative flex shrink-0">
                <Icon className="size-4" />
                {badge}
            </span>
            <span className="group-data-[collapsed=true]:hidden truncate">{label}</span>
        </>
    );

    const linkCls = primary
        ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 hover:text-white'
        : active
          ? 'bg-[var(--sidebar-accent)] font-semibold text-[var(--sidebar-accent-foreground)] shadow-[inset_2px_0_0_0_var(--sidebar-primary)]'
          : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]';

    return (
        <li>
            {href ? (
                <Link
                    href={href}
                    title={label}
                    className={cn(
                        'flex items-center gap-3 rounded-none px-3 py-2 text-sm transition-colors group-data-[collapsed=true]:justify-center group-data-[collapsed=true]:px-0',
                        linkCls,
                    )}
                >
                    {inner}
                </Link>
            ) : (
                <button
                    onClick={onClick}
                    title={label}
                    className={cn(
                        'flex w-full items-center gap-3 rounded-none px-3 py-2 text-sm transition-colors group-data-[collapsed=true]:justify-center group-data-[collapsed=true]:px-0',
                        primary
                            ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 hover:text-white'
                            : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]',
                    )}
                >
                    {inner}
                </button>
            )}
        </li>
    );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1 group-data-[collapsed=true]:mt-2">
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--sidebar-foreground)]/50 group-data-[collapsed=true]:hidden">
                {label}
            </p>
            <ul className="flex flex-col gap-0.5">{children}</ul>
        </div>
    );
}

const REQUEST_STATUSES = [
    { title: 'Pending', status: 'pending', icon: FileClock },
    { title: 'For Reschedule', status: 'for_reschedule', icon: IterationCw },
    { title: 'Approved', status: 'approved', icon: Check },
    { title: 'Conditionally Approved', status: 'conditionally_approved', icon: CheckLine },
    { title: 'Denied', status: 'denied', icon: X },
];

function RequestsNav() {
    const currentStatus =
        (route().params?.status as string | undefined) || new URLSearchParams(window.location.search).get('status');
    const parentActive = route().current('requests.index') && !currentStatus;

    return (
        <Collapsible defaultOpen className="group/collapsible">
            <div className="flex items-center gap-1 group-data-[collapsed=true]:justify-center">
                <Link
                    href={route('requests.index')}
                    title="Requests"
                    className={cn(
                        'flex flex-1 items-center gap-3 rounded-none px-3 py-2 text-sm transition-colors group-data-[collapsed=true]:flex-none group-data-[collapsed=true]:justify-center group-data-[collapsed=true]:px-0',
                        parentActive
                            ? 'bg-[var(--sidebar-accent)] font-semibold text-[var(--sidebar-accent-foreground)] shadow-[inset_2px_0_0_0_var(--sidebar-primary)]'
                            : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]',
                    )}
                >
                    <ClipboardList className="size-4 shrink-0" />
                    <span className="group-data-[collapsed=true]:hidden truncate">Requests</span>
                </Link>
                <CollapsibleTrigger asChild>
                    <button
                        aria-label="Toggle requests submenu"
                        className="flex shrink-0 items-center p-2 text-[var(--sidebar-foreground)] transition-colors hover:text-[var(--sidebar-foreground)] group-data-[collapsed=true]:hidden"
                    >
                        <ChevronRight className="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="group-data-[collapsed=true]:hidden">
                <ul className="flex flex-col gap-0.5">
                    {REQUEST_STATUSES.map((item) => {
                        const Icon = item.icon;
                        const active = route().current('requests.index') && currentStatus === item.status;
                        return (
                            <li key={item.status}>
                                <Link
                                    href={route('requests.index', { status: item.status })}
                                    className={cn(
                                        'flex items-center gap-3 rounded-none py-2 pl-8 pr-3 text-sm transition-colors',
                                        active
                                            ? 'bg-[var(--sidebar-accent)] font-semibold text-[var(--sidebar-accent-foreground)]'
                                            : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]',
                                    )}
                                >
                                    <Icon className="size-4 shrink-0" />
                                    <span className="truncate">{item.title}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </CollapsibleContent>
        </Collapsible>
    );
}

function SidebarBody() {
    const { auth } = usePage<SharedData>().props;
    const { hasPermission } = usePermission();
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);

    const user = auth.user;
    const isPreviewDash = route().current('design.preview');
    const isPreviewCreate = route().current('design.preview.create');

    const handleLogout = (e: React.MouseEvent) => {
        e.preventDefault();
        router.post(route('logout'));
    };

    const showAccounts = hasPermission('manage users');
    const showChatbotLogs = hasPermission('view chatbot logs');

    return (
        <>
            <div className="flex h-16 items-center gap-2.5 border-b border-[var(--sidebar-border)] px-4 group-data-[collapsed=true]:justify-center group-data-[collapsed=true]:px-0">
                <img src={logo} alt="FRAI" className="size-8 shrink-0" />
                <div className="flex flex-col group-data-[collapsed=true]:hidden">
                    <span className="font-display text-xl font-semibold leading-none text-[var(--sidebar-foreground)]">FRAI</span>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 pb-4">
                {/* Preview entry points */}
                <NavSection label="Blueprint Preview">
                    <NavItem icon={LayoutGrid} label="Preview Dashboard" active={isPreviewDash} href={route('design.preview')} />
                    <NavItem icon={CirclePlus} label="Preview Create" active={isPreviewCreate} href={route('design.preview.create')} />
                </NavSection>

                {/* Primary CTAs */}
                <ul className="mt-4 flex flex-col gap-0.5">
                    <NavItem primary icon={CirclePlus} label="Create Request" href={route('design.preview.create')} />
                    <NavItem primary icon={Sparkles} label="Chatbot" onClick={() => setIsChatbotOpen(true)} />
                </ul>

                <NavSection label="Overview">
                    <NavItem icon={LayoutGrid} label="Dashboard" href={route('dashboard')} />
                </NavSection>

                <RequestsNav />

                <NavSection label="Directory">
                    <NavItem icon={BookOpen} label="Rules" href={route('rules')} />
                    <NavItem icon={Box} label="Facilities" href={route('facilities')} />
                    <NavItem icon={Cable} label="Equipments" href={route('equipments')} />
                    {showAccounts && <NavItem icon={User} label="Accounts" href={route('accounts.index')} />}
                    {showChatbotLogs && <NavItem icon={MessagesSquare} label="Chatbot Logs" href={route('chatbot.logs.index')} />}
                </NavSection>
            </nav>

            <div className="border-t border-[var(--sidebar-border)] p-2 group-data-[collapsed=true]:p-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex w-full items-center gap-2.5 rounded-none px-2 py-2 text-left transition-colors hover:bg-[var(--sidebar-accent)] group-data-[collapsed=true]:justify-center group-data-[collapsed=true]:px-0">
                            <div className="flex size-8 shrink-0 items-center justify-center bg-[var(--sidebar-primary)] text-xs font-bold text-white">
                                {getInitials(user?.name ?? 'User')}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col group-data-[collapsed=true]:hidden">
                                <span className="truncate text-sm font-semibold text-[var(--sidebar-foreground)]">{user?.name}</span>
                                <span className="truncate font-mono text-[10px] uppercase tracking-wider text-[var(--sidebar-foreground)]/60">
                                    {(user?.roles?.length ? user.roles : ['User']).join(' · ')}
                                </span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4 shrink-0 text-[var(--sidebar-foreground)]/60 group-data-[collapsed=true]:hidden" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" sideOffset={4} className="min-w-56">
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-3 px-1 py-1.5">
                                <div className="flex size-8 items-center justify-center bg-[var(--sidebar-primary)] text-xs font-bold text-white">
                                    {getInitials(user?.name ?? 'User')}
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">{user?.name}</span>
                                    <span className="truncate text-xs text-[var(--muted-foreground)] capitalize">
                                        {(user?.roles?.length ? user.roles : ['User']).join(', ')}
                                    </span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href={route('settings')}>
                                <Settings className="size-4 shrink-0" />
                                Settings
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleLogout}>
                            <LogOut className="size-4 shrink-0" />
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <ChatbotSessionModal isOpen={isChatbotOpen} onClose={() => setIsChatbotOpen(false)} />
        </>
    );
}

export default function PreviewLayout({ children, crumb }: PreviewLayoutProps) {
    const { dark, toggle } = useTheme();
    const isMobile = useIsMobile();
    const [collapsed, setCollapsed] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Scope the blueprint tokens to the whole document while the preview is
    // mounted. This makes Radix portals (Select/Popover/Dialog, which render
    // into <body>) inherit the mock tokens instead of the live app's.
    useLayoutEffect(() => {
        document.documentElement.classList.add('design-preview');
        return () => document.documentElement.classList.remove('design-preview');
    }, []);

    // Close the mobile drawer after any Inertia navigation completes.
    useEffect(() => {
        return router.on('finish', () => setDrawerOpen(false));
    }, []);

    // Close the mobile drawer with Escape.
    useEffect(() => {
        if (!drawerOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setDrawerOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [drawerOpen]);

    const toggleSidebar = () => {
        if (isMobile) {
            setDrawerOpen((o) => !o);
        } else {
            setCollapsed((c) => !c);
        }
    };

    return (
        <div className="design-preview flex min-h-svh bg-[var(--background)] text-[var(--foreground)]">
            {/* ── Desktop sidebar: surface-matching, icon rail on collapse ── */}
            <div className="group hidden md:flex" data-collapsed={collapsed}>
                <aside className="sticky top-0 flex h-svh w-64 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] transition-[width] duration-200 group-data-[collapsed=true]:w-[70px]">
                    <SidebarBody />
                </aside>
            </div>

            {/* ── Mobile offcanvas drawer (< 768px): always expanded, no rail ── */}
            {drawerOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <button
                        onClick={() => setDrawerOpen(false)}
                        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
                        aria-label="Close sidebar"
                    />
                    <div
                        className="group relative flex h-svh w-64 bg-[var(--sidebar)] text-[var(--sidebar-foreground)] shadow-xl animate-in slide-in-from-left-full duration-300"
                        data-collapsed={false}
                    >
                        <aside className="flex h-full flex-col border-r border-[var(--sidebar-border)]">
                            <SidebarBody />
                        </aside>
                    </div>
                </div>
            )}

            {/* ── Main ─────────────────────────────────────────────────── */}
            <main className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--background)]/90 px-4 backdrop-blur-sm md:px-8">
                    <button
                        onClick={toggleSidebar}
                        className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                        aria-label="Toggle sidebar"
                    >
                        <PanelLeft className="size-4" />
                    </button>
                    <span className="h-4 w-px bg-[var(--border)]" />
                    <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--muted-foreground)]">
                        <span>GSO</span>
                        <span className="text-[var(--border)]">/</span>
                        <span>design</span>
                        <span className="text-[var(--border)]">/</span>
                        <span className="text-[var(--foreground)]">{crumb}</span>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 border border-[var(--bp-amber)]/40 bg-[var(--bp-amber-bg)] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--bp-amber)]">
                            <span className="size-1.5 rounded-full bg-[var(--bp-amber)]" />
                            Mockup · not the final design
                        </span>
                        <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle theme" className="text-[var(--muted-foreground)]">
                            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                        </Button>
                        <Link href={route('settings')} className="text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]" aria-label="Settings">
                            <Settings className="size-4" />
                        </Link>
                    </div>
                </header>

                <div className="flex-1 px-4 py-8 md:px-8 lg:px-10">{children}</div>

                <footer className="border-t border-[var(--border)] px-4 py-3 md:px-8">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]/70">
                        FRAI · Blueprint design preview · see docs/design-system.md for the spec
                    </p>
                </footer>
            </main>
        </div>
    );
}
