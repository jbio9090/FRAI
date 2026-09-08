import { router, Link, usePage } from '@inertiajs/react';
import {
    Eye, Mail, Calendar, Shield, User, Key, ArrowLeft,
    Search, Filter, ArrowDownUp, ChevronLeft, ChevronRight,
    FileText, UserRoundPen, Activity
} from 'lucide-react';
import moment from 'moment';
import { useState, useEffect, useMemo, useRef } from 'react';
import { route } from 'ziggy-js';
import { ActivityFeed } from '@/components/activity-feed';
import type { AuditLog } from '@/components/activity-feed';
import AvatarWithInitials from '@/components/avatar-with-initials';
import RequestCard from '@/components/request-card';
import SmartPagination from '@/components/SmartPagination';
import StatusTag from '@/components/status-tag';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RoleBadge } from '@/components/ui/role-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { cn } from '@/lib/utils';
import type { AccountsDetailProps } from '@/types/auth';
import type { Request } from '@/types/request';

export default function AccountDetailPage({
    user,
    audit_logs,
    requests,
    audit_events,
    request_statuses,
    can_edit_own,
}: AccountsDetailProps) {
    const { auth } = usePage<{ auth: { user: { id: number } } }>().props;
    const { hasRole } = usePermission();
    const isAdmin = hasRole('admin') || hasRole('Super Admin');
    const isOwnAccount = auth.user.id === user.id;

    const [activeTab, setActiveTab] = useState<'activity' | 'requests'>('activity');

    const [auditRange, setAuditRange] = useState<'day' | 'week' | 'month' | '3months'>('week');
    const setAuditRangeTyped = setAuditRange as (value: string) => void;
    const setActiveTabTyped = setActiveTab as (value: string) => void;
    const [auditEvent, setAuditEvent] = useState<string>('all');
    const [auditSearch, setAuditSearch] = useState('');
    const [auditSort, setAuditSort] = useState<'newest' | 'oldest'>('newest');
    const [auditLogsLoading, setAuditLogsLoading] = useState(false);
    const [auditLogsData, setAuditLogsData] = useState<AuditLog[]>(audit_logs.data);
    const [auditCurrentPage, setAuditCurrentPage] = useState(audit_logs.current_page);
    const [auditLastPage, setAuditLastPage] = useState(audit_logs.last_page);
    const [auditTotal, setAuditTotal] = useState(audit_logs.total);

    const [requestStatus, setRequestStatus] = useState<string[]>([]);
    const [requestSearch, setRequestSearch] = useState('');
    const [requestSort, setRequestSort] = useState<'created_at' | 'title' | 'priority_level'>('created_at');
    const setRequestSortTyped = setRequestSort as (value: 'created_at' | 'title' | 'priority_level') => void;
    const [requestOrder, setRequestOrder] = useState<'asc' | 'desc'>('desc');
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [requestsData, setRequestsData] = useState<Request[]>(requests.data);
    const [requestsCurrentPage, setRequestsCurrentPage] = useState(requests.current_page);
    const [requestsLastPage, setRequestsLastPage] = useState(requests.last_page);
    const [requestsTotal, setRequestsTotal] = useState(requests.total);

    const isInitialMount = useRef(true);

    const fetchAuditLogs = (page = 1) => {
        setAuditLogsLoading(true);
        const params = new URLSearchParams({
            page: String(page),
            audit_range: auditRange,
            audit_sort: auditSort,
        });
        if (auditEvent !== 'all') params.set('audit_event', auditEvent);
        if (auditSearch) params.set('audit_search', auditSearch);

        router.get(route('accounts.show', user.id), Object.fromEntries(params), {
            only: ['audit_logs', 'audit_events'],
            preserveState: true,
            preserveScroll: true,
            onSuccess: (page) => {
                setAuditLogsData(page.props.audit_logs.data);
                setAuditCurrentPage(page.props.audit_logs.current_page);
                setAuditLastPage(page.props.audit_logs.last_page);
                setAuditTotal(page.props.audit_logs.total);
                setAuditLogsLoading(false);
            },
            onError: () => setAuditLogsLoading(false),
        });
    };

    const fetchRequests = (page = 1) => {
        setRequestsLoading(true);
        const params = new URLSearchParams({ page: String(page) });
        if (requestStatus.length) params.set('request_status', requestStatus.join(','));
        if (requestSearch) params.set('request_search', requestSearch);
        params.set('request_sort', requestSort);
        params.set('request_order', requestOrder);

        router.get(route('accounts.show', user.id), Object.fromEntries(params), {
            only: ['requests', 'request_statuses'],
            preserveState: true,
            preserveScroll: true,
            onSuccess: (page) => {
                setRequestsData(page.props.requests.data);
                setRequestsCurrentPage(page.props.requests.current_page);
                setRequestsLastPage(page.props.requests.last_page);
                setRequestsTotal(page.props.requests.total);
                setRequestsLoading(false);
            },
            onError: () => setRequestsLoading(false),
        });
    };

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const timeout = setTimeout(() => {
            fetchAuditLogs(1);
        }, 300);
        return () => clearTimeout(timeout);
    }, [auditRange, auditEvent, auditSearch, auditSort]);

    useEffect(() => {
        if (isInitialMount.current) {
            return;
        }
        const timeout = setTimeout(() => {
            fetchRequests(1);
        }, 300);
        return () => clearTimeout(timeout);
    }, [requestStatus, requestSearch, requestSort, requestOrder]);

    const auditRangeOptions = [
        { label: 'Today', value: 'day' as const },
        { label: 'Last 7 days', value: 'week' as const },
        { label: 'This month', value: 'month' as const },
        { label: 'Last 3 months', value: '3months' as const },
    ];

    const requestSortOptions = [
        { label: 'Date Submitted', value: 'created_at' as const },
        { label: 'Title', value: 'title' as const },
        { label: 'Priority', value: 'priority_level' as const },
    ];

    return (
        <DefaultLayout>
            <div className="flex items-center gap-2 mb-4">
                <Link
                    href={route('accounts.index')}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Accounts
                </Link>
                <span className="text-muted-foreground">/</span>
                <span className="text-sm font-medium">{user.name}</span>
            </div>

            {/* Profile Card - Always visible above tabs */}
            <Card className="max-w-2xl mb-6">
                <CardHeader>
                    <div className="flex items-start gap-4">
                        <AvatarWithInitials
                            username={user.name}
                            avatarSrc={user.profile}
                            size="lg"
                        />
                        <div className="flex-1 min-w-0">
                            <h2 className="font-display text-xl font-semibold">{user.name}</h2>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            {user.position && (
                                <p className="text-sm text-muted-foreground mt-1">{user.position}</p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <RoleBadge roles={[user.role]} variant="default" />
                                <span className={cn(
                                    'inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold',
                                    user.is_active
                                        ? 'bg-[var(--ads-ok-bg)] text-[var(--ads-ok)]'
                                        : 'bg-[var(--ads-neutral-bg)] text-[var(--ads-neutral)]'
                                )}>
                                    <span className="size-1.5 rounded-full bg-current" />
                                    {user.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                        {isOwnAccount && can_edit_own && (
                            <Link href={route('settings')}>
                                <Button variant="outline" size="sm" className="shrink-0">
                                    <UserRoundPen className="h-4 w-4" />
                                    Edit Profile
                                </Button>
                            </Link>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                            <dt className="text-muted-foreground">Created</dt>
                            <dd className="font-medium">{moment(user.created_at).format('MMMM D, YYYY h:mm A')}</dd>
                        </div>
                        {user.deleted_at && (
                            <div>
                                <dt className="text-muted-foreground">Archived</dt>
                                <dd className="font-medium">{moment(user.deleted_at).format('MMMM D, YYYY h:mm A')}</dd>
                            </div>
                        )}
                    </dl>
                </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTabTyped}>
                <TabsList variant="line" className="w-full">
                    <TabsTrigger value="activity">
                        <Activity className="h-4 w-4" />
                        Activity
                    </TabsTrigger>
                    <TabsTrigger value="requests">Requests</TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <CardTitle className="text-sm font-semibold">Activity</CardTitle>
                                <CardDescription>Activity history for this user</CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Select value={auditRange} onValueChange={setAuditRangeTyped}>
                                    <SelectTrigger className="w-36 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {auditRangeOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn('flex items-center gap-2', auditEvent !== 'all' && 'border-primary bg-primary/5 text-primary')}
                                        >
                                            <Filter size={14} />
                                            <span>Event</span>
                                            {auditEvent !== 'all' && (
                                                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/12 px-1 text-[10px] font-medium text-primary">
                                                    1
                                                </span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-0" align="start">
                                        <div className="p-3 max-h-64 overflow-y-auto">
                                            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                                                <input type="radio" name="audit-event" className="accent-primary" checked={auditEvent === 'all'} onChange={() => setAuditEvent('all')} />
                                                All event types
                                            </label>
                                            {audit_events.map(ev => (
                                                <label key={ev.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                                                    <input type="radio" name="audit-event" className="accent-primary" checked={auditEvent === ev.value} onChange={() => setAuditEvent(ev.value)} />
                                                    {ev.label}
                                                </label>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search..."
                                        value={auditSearch}
                                        onChange={e => setAuditSearch(e.target.value)}
                                        className="pl-8 w-48 text-xs"
                                    />
                                </div>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn('flex items-center gap-2', auditSort !== 'newest' && 'border-primary bg-primary/5 text-primary')}
                                        >
                                            <ArrowDownUp size={14} />
                                            <span>Sort</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-40 p-0" align="start">
                                        <div className="p-1">
                                            {[
                                                { label: 'Newest first', value: 'newest' as const },
                                                { label: 'Oldest first', value: 'oldest' as const },
                                            ].map(opt => (
                                                <Button
                                                    key={opt.value}
                                                    variant={auditSort === opt.value ? 'secondary' : 'ghost'}
                                                    size="sm"
                                                    className="w-full justify-start px-2"
                                                    onClick={() => setAuditSort(opt.value)}
                                                >
                                                    {opt.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {auditLogsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Spinner size="sm" className="mr-2" />
                                    Loading activity...
                                </div>
                            ) : auditLogsData.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">No activity found.</p>
                            ) : (
                                <>
                                    <ActivityFeed auditLogs={auditLogsData} />
                                    <SmartPagination
                                        currentPage={auditCurrentPage}
                                        lastPage={auditLastPage}
                                        onPageChange={fetchAuditLogs}
                                        className="mt-4"
                                    />
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="requests" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <CardTitle className="text-sm font-semibold">Requests</CardTitle>
                                <CardDescription>All requests submitted by this user</CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search requests..."
                                        value={requestSearch}
                                        onChange={e => setRequestSearch(e.target.value)}
                                        className="pl-8 w-56 text-xs"
                                    />
                                </div>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={cn('flex items-center gap-2', requestStatus.length && 'border-primary bg-primary/5 text-primary')}
                                        >
                                            <Filter size={14} />
                                            <span>Status</span>
                                            {requestStatus.length && (
                                                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/12 px-1 text-[10px] font-medium text-primary">
                                                    {requestStatus.length}
                                                </span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-0" align="start">
                                        <div className="p-3 max-h-64 overflow-y-auto">
                                            {request_statuses.map(opt => (
                                                <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                                                    <input
                                                        type="checkbox"
                                                        className="accent-primary"
                                                        checked={requestStatus.includes(opt.value)}
                                                        onChange={e => setRequestStatus(prev =>
                                                            e.target.checked ? [...prev, opt.value] : prev.filter(v => v !== opt.value)
                                                        )}
                                                    />
                                                    {opt.label}
                                                </label>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                                            <ArrowDownUp size={14} />
                                            <span>Sort</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-0" align="start">
                                        <div className="p-1">
                                            {requestSortOptions.map(opt => (
                                                <Button
                                                    key={opt.value}
                                                    variant={requestSort === opt.value ? 'secondary' : 'ghost'}
                                                    size="sm"
                                                    className="w-full justify-start px-2"
                                                    onClick={() => setRequestSortTyped(opt.value)}
                                                >
                                                    {opt.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {requestsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Spinner size="sm" className="mr-2" />
                                    Loading requests...
                                </div>
                            ) : requestsData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="flex size-10 items-center justify-center rounded-full bg-muted mb-3">
                                        <FileText className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-semibold">No requests found</p>
                                    <p className="text-sm text-muted-foreground">This user hasn't submitted any requests yet.</p>
                                </div>
                            ) : (
                                <>
                                    <div
                                        className="mt-8 flex w-full flex-col items-stretch gap-4 p-2 sm:grid sm:px-4 md:px-8"
                                        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(max(24rem, calc(50% - 0.5rem)), 1fr))' }}
                                    >
                                        {requestsData.map(request => (
                                            <RequestCard
                                                key={request.id}
                                                request={request}
                                                page_title="User Requests"
                                                className="w-full"
                                            />
                                        ))}
                                    </div>
                                    <SmartPagination
                                        currentPage={requestsCurrentPage}
                                        lastPage={requestsLastPage}
                                        onPageChange={fetchRequests}
                                        className="mt-4"
                                    />
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </DefaultLayout>
    );
}