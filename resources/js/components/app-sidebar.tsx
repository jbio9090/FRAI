import AddIcon from '@atlaskit/icon/core/add';
import BookWithBookmarkIcon from '@atlaskit/icon/core/book-with-bookmark';
import CheckCircleIcon from '@atlaskit/icon/core/check-circle';
import CheckMarkIcon from '@atlaskit/icon/core/check-mark';
import ChevronDownIcon from '@atlaskit/icon/core/chevron-down';
import ChevronRightIcon from '@atlaskit/icon/core/chevron-right';
import ClipboardIcon from '@atlaskit/icon/core/clipboard';
import ClockIcon from '@atlaskit/icon/core/clock';
import ComponentIcon from '@atlaskit/icon/core/component';
import CrossCircleIcon from '@atlaskit/icon/core/cross-circle';
import GridIcon from '@atlaskit/icon/core/grid';
import LogOutIcon from '@atlaskit/icon/core/log-out';
import OfficeBuildingIcon from '@atlaskit/icon/core/office-building';
import PersonIcon from '@atlaskit/icon/core/person';
import RefreshIcon from '@atlaskit/icon/core/refresh';
import SettingsIcon from '@atlaskit/icon/core/settings';
import { Link, router, usePage } from '@inertiajs/react';
import * as React from 'react';
import AvatarWithInitials from '@/components/avatar-with-initials';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleBadge } from '@/components/ui/role-badge';
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
import { useIsMobile } from '@/hooks/use-mobile';
import logo from '@/svg/FRAI.svg';
import type { SharedData } from '@/types';
import { Button } from './ui/button';

const iconRailItem = 'group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { hasPermission } = usePermission();
    const { auth } = usePage<SharedData>().props;
    const hasUnreadNotifications = Number(auth.user?.notification_unread_count ?? 0) > 0;
    const isMobile = useIsMobile();

    const data = {
        topNav: [
            { title: 'Dashboard', url: 'dashboard', icon: GridIcon },
            { title: 'Rules', url: 'rules', icon: BookWithBookmarkIcon },
            { title: 'Facilities', url: 'facilities', icon: OfficeBuildingIcon },
            { title: 'Equipments', url: 'equipments', icon: ComponentIcon },
            ...(hasPermission('manage users') ? [{ title: 'Accounts', url: 'accounts.index', icon: PersonIcon }] : []),
                        ...(hasPermission('manage request options') ? [{ title: 'Request Options', url: 'request-options', icon: SettingsIcon }] : []),
        ],
        navMenu: [
            { title: 'Pending', url: route('requests.index', { status: 'pending' }), status: 'pending', icon: ClockIcon },
            { title: 'For Reschedule', url: route('requests.index', { status: 'for_reschedule' }), status: 'for_reschedule', icon: RefreshIcon },
            { title: 'Approved', url: route('requests.index', { status: 'approved' }), status: 'approved', icon: CheckCircleIcon },
            {
                title: 'Conditionally Approved',
                url: route('requests.index', { status: 'conditionally_approved' }),
                status: 'conditionally_approved',
                icon: CheckMarkIcon,
            },
            { title: 'Denied', url: route('requests.index', { status: 'denied' }), status: 'denied', icon: CrossCircleIcon },
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
            className="[&_[data-slot=sidebar-container]]:z-[100] [&_[data-slot=sidebar-inner]]:border-r [&_[data-slot=sidebar-inner]]:border-sidebar-border [&_[data-slot=sidebar-inner]]:bg-sidebar"
        >
            {/* ── Header / Logo ─────────────────────────────────────────── */}
            {/*
        h-16 matches the main topbar exactly so the logo aligns across the divider.
        iconRailItem on the SidebarMenuItem centers the logo button in the 70px rail.
      */}
            <SidebarHeader className="flex h-16 flex-col justify-center px-2 py-0 md:mt-0">
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
                                <span className="font-display text-2xl font-semibold text-[var(--foreground)] group-data-[collapsible=icon]:hidden">
                                    FRAI
                                </span>
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
                                <AddIcon label="Create Request" color="currentColor" />
                                <span className="group-data-[collapsible=icon]:hidden">Create Request</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Top-nav items */}
                    {data.topNav.map((item) => (
                        <SidebarMenuItem key={item.title} className={`px-2 ${iconRailItem}`}>
                            <SidebarMenuButton asChild isActive={checkRoute(item.url)} tooltip={item.title}>
                                <Link href={route(item.url)}>
                                    <span className="relative flex shrink-0">
                                        <item.icon label={item.title} color="currentColor" />
                                        {item.url === 'dashboard' && hasUnreadNotifications && (
                                            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-[var(--primary)]" />
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
                                    <ClipboardIcon label="Requests" color="currentColor" />
                                    <span className="group-data-[collapsible=icon]:hidden">Requests</span>
                                </Link>
                            </SidebarMenuButton>

                            <CollapsibleTrigger asChild>
                                <Button className="flex shrink-0 items-center group-data-[collapsible=icon]:hidden" variant="ghost">
                                    <span className="flex items-center transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90">
                                        <ChevronRightIcon label="Expand requests" color="currentColor" />
                                    </span>
                                </Button>
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
                                                <item.icon label={item.title} color="currentColor" />
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    tooltip={auth.user.name}
                                    className="cursor-pointer gap-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                >
                                    <AvatarWithInitials username={auth.user.name} avatarSrc={auth.user.profile} size="sm" />
<div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
    <span className="truncate font-semibold">{auth.user.name}</span>
    <RoleBadge roles={auth.user.roles} variant="sm" />
</div>
                                    <span className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden">
                                        <ChevronDownIcon label="Account menu" color="currentColor" />
                                    </span>
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className={`min-w-56 rounded-lg ${isMobile ? 'z-[60]' : ''}`} side="top" align="end" sideOffset={4}>
                                <DropdownMenuLabel className="p-0 font-normal">
                                    <div className="flex items-center gap-3 px-1 py-1.5">
                                        <AvatarWithInitials username={auth.user.name} avatarSrc={auth.user.profile} size="sm" />
<div className="grid flex-1 text-left text-sm leading-tight">
    <span className="truncate font-semibold">{auth.user.name}</span>
    <RoleBadge roles={auth.user.roles} variant="sm" />
</div>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href={route('settings')}>
                                        <SettingsIcon label="Settings" color="currentColor" />
                                        Settings
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleLogout}>
                                    <LogOutIcon label="Log out" color="currentColor" />
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
