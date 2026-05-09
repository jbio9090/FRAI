import { Link, router, usePage } from '@inertiajs/react';
import {
    LayoutGrid,
    FileClock,
    LogOut,
    CirclePlus,
    CheckLine,
    X,
    BookOpen,
    Box,
    Settings,
    Check,
    User,
    Sparkles,
    Cable,
    IterationCw,
    MessagesSquare,
    ChevronRight,
    ClipboardList,
} from 'lucide-react';
import * as React from 'react';
import ChatbotSessionModal from '@/components/ChatbotSessionModal';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarFooter,
    SidebarSeparator,
} from '@/components/ui/sidebar';
import { usePermission } from '@/hooks/use-permission';
import logo from '@/svg/FRAI.svg';
import type { SharedData } from '@/types';

const iconRailItem = 'group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { hasPermission } = usePermission();
    const { auth } = usePage<SharedData>().props;
    const hasUnreadNotifications = Number(auth.user?.notification_unread_count ?? 0) > 0;
    const [isChatbotModalOpen, setIsChatbotModalOpen] = React.useState(false);

    const data = {
        topNav: [
            { title: 'Dashboard', url: 'dashboard', icon: LayoutGrid },
            { title: 'Rules', url: 'rules', icon: BookOpen },
            { title: 'Facilities', url: 'facilities', icon: Box },
            { title: 'Equipments', url: 'equipments', icon: Cable },
            ...(hasPermission('manage users') ? [{ title: 'Accounts', url: 'accounts.index', icon: User }] : []),
            ...(hasPermission('view chatbot logs') ? [{ title: 'Chatbot Logs', url: 'chatbot.logs.index', icon: MessagesSquare }] : []),
        ],
        navMenu: [
            { title: 'Pending', url: route('requests.index', { status: 'pending' }), status: 'pending', icon: FileClock },
            { title: 'For Reschedule', url: route('requests.index', { status: 'for_reschedule' }), status: 'for_reschedule', icon: IterationCw },
            { title: 'Approved', url: route('requests.index', { status: 'approved' }), status: 'approved', icon: Check },
            {
                title: 'Conditionally Approved',
                url: route('requests.index', { status: 'conditionally_approved' }),
                status: 'conditionally_approved',
                icon: CheckLine,
            },
            { title: 'Denied', url: route('requests.index', { status: 'denied' }), status: 'denied', icon: X },
        ],
    };

    const handleLogout = (e: React.MouseEvent) => {
        e.preventDefault();
        router.post(route('logout'));
    };

    const checkRoute = (routeName: string) => route().current(routeName);

    const currentStatus = route().params?.status || new URLSearchParams(window.location.search).get('status');

    return (
        <Sidebar
            collapsible="icon"
            {...props}
            className="[&_[data-slot=sidebar-container]]:z-[100] [&_[data-slot=sidebar-container]]:pt-4 [&_[data-slot=sidebar-inner]]:rounded-tr-2xl [&_[data-slot=sidebar-inner]]:bg-sidebar"
        >
            {/* ── Header / Logo ─────────────────────────────────────────── */}
            {/*
        h-16 matches the main topbar exactly so the logo aligns across the divider.
        iconRailItem on the SidebarMenuItem centers the logo button in the 70px rail.
      */}
            <SidebarHeader className="flex h-16 flex-col justify-center px-2">
                <SidebarMenu>
                    <SidebarMenuItem className={iconRailItem}>
                        <SidebarMenuButton
                            asChild
                            size="lg"
                            tooltip="FRAI"
                            className="hover:bg-transparent active:bg-transparent data-[active=true]:bg-transparent data-[active=true]:shadow-none"
                        >
                            <Link href={route('dashboard')}>
                                <img src={logo} alt="FRAI logo" className="h-8 w-8 shrink-0" />
                                <span className="font-display text-2xl font-semibold group-data-[collapsible=icon]:hidden">FRAI</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            {/* ── Content ───────────────────────────────────────────────── */}
            <SidebarContent>
                <SidebarMenu>
                    {/* Create Request — no unprefixed justify-center so text stays left in expanded */}
                    <SidebarMenuItem className={`mt-2 px-2 ${iconRailItem}`}>
                        <SidebarMenuButton
                            asChild
                            tooltip="Create Request"
                            className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:text-foreground"
                        >
                            <Link href={route('request.create')}>
                                <CirclePlus className="h-4 w-4 shrink-0" />
                                <span className="group-data-[collapsible=icon]:hidden">Create Request</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Chatbot */}
                    <SidebarMenuItem className={`px-2 ${iconRailItem}`}>
                        <SidebarMenuButton
                            tooltip="Chatbot"
                            className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground dark:text-foreground"
                            onClick={() => setIsChatbotModalOpen(true)}
                        >
                            <Sparkles className="h-4 w-4 shrink-0" />
                            <span className="group-data-[collapsible=icon]:hidden">Chatbot</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Top-nav items */}
                    {data.topNav.map((item) => (
                        <SidebarMenuItem key={item.title} className={`px-2 ${iconRailItem}`}>
                            <SidebarMenuButton asChild isActive={checkRoute(item.url)} tooltip={item.title}>
                                <Link href={route(item.url)}>
                                    <span className="relative flex shrink-0">
                                        <item.icon className="h-4 w-4" />
                                        {item.url === 'dashboard' && hasUnreadNotifications && (
                                            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500" />
                                        )}
                                    </span>
                                    <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}

                    {/* ── Requests collapsible ────────────────────────────── */}
                    <Collapsible defaultOpen className="group/collapsible">
                        {/*
              The Requests row has both a link and a chevron.
              iconRailItem centers the whole row in icon mode;
              flex-none on the button lets it shrink back to size-8.
            */}
                        <SidebarMenuItem className={`flex items-center gap-1 px-2 ${iconRailItem}`}>
                            <SidebarMenuButton
                                asChild
                                isActive={route().current('requests.index') && !currentStatus}
                                tooltip="Requests"
                                className="flex-1 group-data-[collapsible=icon]:flex-none"
                            >
                                <Link href={route('requests.index')}>
                                    <ClipboardList className="h-4 w-4 shrink-0" />
                                    <span className="group-data-[collapsible=icon]:hidden">Requests</span>
                                </Link>
                            </SidebarMenuButton>

                            <CollapsibleTrigger asChild>
                                <button className="flex shrink-0 items-center justify-center rounded-sm p-1 group-data-[collapsible=icon]:hidden hover:bg-white">
                                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                </button>
                            </CollapsibleTrigger>
                        </SidebarMenuItem>

                        <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                            <SidebarMenu>
                                {data.navMenu.map((item) => (
                                    <SidebarMenuItem key={item.title} className="px-2">
                                        <SidebarMenuButton
                                            asChild
                                            isActive={route().current('requests.index') && currentStatus === item.status}
                                            className="pl-8"
                                        >
                                            <Link href={item.url}>
                                                <item.icon className="h-4 w-4 shrink-0" />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </CollapsibleContent>
                    </Collapsible>
                </SidebarMenu>
            </SidebarContent>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <SidebarSeparator className="mx-0" />
            <SidebarFooter className="px-2 group-data-[collapsible=icon]:px-0">
                <SidebarMenu className="pb-4">
                    <SidebarMenuItem className={iconRailItem}>
                        <SidebarMenuButton asChild tooltip="Settings">
                            <Link href={route('settings')} className="w-full cursor-pointer">
                                <Settings className="h-4 w-4 shrink-0" />
                                <span className="group-data-[collapsible=icon]:hidden">Settings</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    <SidebarMenuItem className={iconRailItem}>
                        <SidebarMenuButton asChild tooltip="Logout">
                            <button onClick={handleLogout} className="w-full cursor-pointer">
                                <LogOut className="h-4 w-4 shrink-0" />
                                <span className="group-data-[collapsible=icon]:hidden">Logout</span>
                            </button>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />

            <ChatbotSessionModal isOpen={isChatbotModalOpen} onClose={() => setIsChatbotModalOpen(false)} />
        </Sidebar>
    );
}
