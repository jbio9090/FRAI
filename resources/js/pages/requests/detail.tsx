import { Link, usePage } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import { Calendar, Clock, SendHorizontal, Pen, CheckCircle, XCircle, ClipboardCheck, MessageSquare, Sparkles, Download } from 'lucide-react';
import moment from 'moment';
import { useState } from 'react';
import { ActivityFeed } from '@/components/activity-feed';
import { BookingCard } from '@/components/booking-card';
import { cn } from '@/lib/utils';
import AnimatedText from '@/components/animated-text';
import { AttachedFileList } from '@/components/attached-file-list';
import AvatarWithInitials from '@/components/avatar-with-initials';
import Comment from '@/components/comment';
import { downloadSingleRequestCSV } from '@/lib/downloadCSV';
import { downloadFacilitiesPDF } from '@/components/pdf/FacilitiesPDF';
import SmartPagination from '@/components/SmartPagination';
import StatusTag from '@/components/status-tag';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import type { Request } from '@/types/request';

interface DetailProps {
    children?: React.ReactNode;
    request: Request | null;
    auditLogs: { data: any[]; current_page: number; last_page: number; total: number } | null;
}

type RecommendedAction = 'Approved' | 'Conditionally Approved' | 'Denied' | 'For Reschedule' | string;

function RecommendationBadge({ action }: { action: RecommendedAction }) {
    const map: Record<string, { className: string; icon: React.ReactNode }> = {
        approved: {
            className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
            icon: <CheckCircle className="h-3.5 w-3.5" />,
        },
        'conditionally approved': {
            className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800',
            icon: <ClipboardCheck className="h-3.5 w-3.5" />,
        },
        denied: {
            className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
            icon: <XCircle className="h-3.5 w-3.5" />,
        },
        'for reschedule': {
            className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
            icon: <Calendar className="h-3.5 w-3.5" />,
        },
    };

    const key = action.toLowerCase();
    const style = map[key] ?? {
        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
        icon: <Sparkles className="h-3.5 w-3.5" />,
    };

    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold', style.className)}>
            {style.icon}
            {action}
        </span>
    );
}

export default function RequestDetail({ request, auditLogs: auditLogsProp }: DetailProps) {
    const auth = usePage().props.auth;
    const [comment, setComment] = useState('');
    const [isCommenting, setCommentInputState] = useState(false);
    const { hasRole } = usePermission();
    const isAdmin = hasRole('admin');

    const [auditLogs, setAuditLogs] = useState(auditLogsProp?.data ?? []);
    const [currentPage, setCurrentPage] = useState(auditLogsProp?.current_page ?? 1);
    const [lastPage, setLastPage] = useState(auditLogsProp?.last_page ?? 1);
    const [totalLogs, setTotalLogs] = useState(auditLogsProp?.total ?? 0);
    const [logsLoading, setLogsLoading] = useState(false);

    if (!request || !auditLogsProp) {
        return (
            <DefaultLayout>
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Loading request...
                </div>
            </DefaultLayout>
        );
    }

    const fetchAuditLogs = async (page: number) => {
        if (!request) return;
        setLogsLoading(true);
        const res = await fetch(`/requests/${request.id}/audit-logs?page=${page}`);
        const json = await res.json();
        setAuditLogs(json.data);
        setCurrentPage(json.current_page);
        setLastPage(json.last_page);
        setTotalLogs(json.total);
        setLogsLoading(false);
    };

    const canEdit = request.status === 'Pending' && !request.on_hold && request.user.id === auth.user.id;

    const canReschedule = request.status === 'For Reschedule' && request.user.id === auth.user.id;

    const handleAction = (action: string) => {
        const inertiaOptions = {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setComment('');
                setCommentInputState(false);
            },
        };

        if (action === 'hold') {
            router.post(route('requests.hold', request.id), {}, inertiaOptions);
            return;
        }

        if (action === 'comment') {
            router.post(
                route('requests.updateStatus', request.id),
                {
                    action: 'comment',
                    comment: comment.trim(),
                },
                inertiaOptions,
            );
            return;
        }

        router.post(
            route('requests.updateStatus', request.id),
            {
                action,
                comment: comment.length > 0 ? comment : null,
            },
            inertiaOptions,
        );
    };

    // Build the bookings array for PDF export
    const facilitiesForPDF = request.request_facilities.map((rf) => {
        const facility = request.facilities.find((f) => f.id === rf.facility_id);
        return {
            facility_name: facility?.name ?? 'Unknown Facility',
            date: rf.date_requested,
            time_start: rf.time_start,
            time_end: rf.time_end,
            has_outsiders: rf.has_outsiders ?? false,
            expected_capacity: rf.expected_capacity ?? null,
        };
    });

    console.log(request);

    return (
        <DefaultLayout hasPadding={false}>
            <div className="flex w-full flex-col gap-4 *:text-sm">
                <div className="flex flex-col gap-3 px-6 pt-6 md:px-8 md:pt-8">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{request.title}</h1>
                        {canEdit && (
                            <Link href={route('requests.edit', request.id)}>
                                <Button variant={'ghost'} size={'icon-sm'}>
                                    <Pen className="h-4 w-4" />
                                </Button>
                            </Link>
                        )}
                        {canReschedule && (
                            <Link href={route('requests.edit', request.id)}>
                                <Button variant={'outline'} size={'sm'} className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50">
                                    <Calendar className="h-4 w-4" />
                                    Reschedule
                                </Button>
                            </Link>
                        )}
                    </div>

                    <StatusTag requestStatus={request.status} />

                    {isAdmin && (
                        <div className="mt-2 flex w-full max-w-2xl flex-col">
                            <div className="flex items-center">
                                <div className="flex flex-col text-sm">
                                    <span className="font-semibold text-muted-foreground">Recommendation</span>
                                    {request.recommended_action ? (
                                        <>
                                            <span className={cn('text-lg font-black', request.recommended_action === 'Denied' && 'text-destructive')}>
                                                {request.recommended_action}
                                            </span>
                                            {request.recommended_action_reason && (
                                                <p className="mt-0.5 max-w-sm text-muted-foreground">{request.recommended_action_reason}</p>
                                            )}
                                        </>
                                    ) : (
                                        <AnimatedText italize={true} />
                                    )}
                                </div>

                                <div className="ml-auto flex justify-end gap-2 self-start">
                                    <Button size="sm" className="hidden xs:block" onClick={() => handleAction('approve')}>
                                        Approve
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="hidden hover:border-destructive hover:bg-destructive/5 hover:text-destructive xs:block"
                                        onClick={() => handleAction('reject')}
                                    >
                                        Deny
                                    </Button>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button size="sm" variant="outline">
                                                <span className="hidden xs:block">More</span>
                                                <span className="block xs:hidden">Actions</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuGroup className="*:cursor-pointer">
                                                <DropdownMenuItem onClick={() => handleAction('approve')} className="xs:hidden">
                                                    <span>Approve</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAction('reject')} className="xs:hidden">
                                                    <span>Deny</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAction('conditionally_approve')}>
                                                    Conditionally Approve
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAction('for_reschedule')}>
                                                    Mark for Reschedule
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setCommentInputState((p) => !p)}>
                                                    {isCommenting ? 'Cancel Note' : 'Add Note'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAction('hold')}>Hold Request</DropdownMenuItem>
                                            </DropdownMenuGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {isCommenting && (
                                <div className="mt-3 flex flex-col gap-2">
                                    <Textarea
                                        placeholder="Add an optional reason or note..."
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        rows={2}
                                        className="w-full resize-none bg-muted/30 text-sm"
                                    />
                                    {comment.trim().length > 0 && (
                                        <Button size="sm" variant="outline" className="self-start" onClick={() => handleAction('comment')}>
                                            Post Note
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <Tabs defaultValue="overview" className="mt-4 w-full">
                    <ScrollArea className="w-full" type="scroll">
                        <TabsList variant="line" className="ml-6 w-fit border-b md:ml-8">
                            <TabsTrigger value="overview">Overview</TabsTrigger>

                            <TabsTrigger value="facilities" className="flex items-center gap-2">
                                <span>Facilities</span>
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-medium text-secondary-foreground">
                                    {request.facilities.length}
                                </span>
                            </TabsTrigger>

                            <TabsTrigger value="comments" className="flex items-center gap-2">
                                <span>Comments</span>
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-medium text-secondary-foreground">
                                    {request.comments.length}
                                </span>
                            </TabsTrigger>

                            <TabsTrigger value="activity" className="flex items-center gap-2">
                                <span>Activity</span>
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-medium text-secondary-foreground">
                                    {totalLogs}
                                </span>
                            </TabsTrigger>

                            <TabsTrigger value="files" className="flex items-center gap-2">
                                <span>Files</span>
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-medium text-secondary-foreground">
                                    {request.files?.length ?? 0}
                                </span>
                            </TabsTrigger>
                        </TabsList>
                        <ScrollBar orientation="horizontal" className="h-0" />
                    </ScrollArea>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="mt-6 flex grid-cols-[8fr_6fr] flex-col gap-6 px-6 md:grid md:px-8">
                        <div className="flex grid-cols-2 flex-col gap-4 md:grid">
                            <div className="flex max-w-full flex-col">
                                <p className="mb-2 font-semibold text-muted-foreground">Description</p>
                                <p>{request.description ? request.description : 'No Description Provided'}</p>
                            </div>

                            <div className="flex flex-wrap gap-12">
                                <div className="flex flex-col">
                                    <p className="mb-2 font-semibold text-muted-foreground">Requested by</p>
                                    <div className="flex items-center gap-2">
                                        <AvatarWithInitials avatarSrc={request.user.profile} username={request.user.name} size="sm" />
                                        <p>{request.user.name}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <p className="mb-2 font-semibold text-muted-foreground">Date Submitted</p>
                                    <p>{moment(request.created_at).format('MMMM D, YYYY')}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-12">
                                <div className="flex flex-col">
                                    <p className="mb-2 font-semibold text-muted-foreground">Processed by</p>
                                    {request.processed_by ? (
                                        <div className="flex items-center gap-2">
                                            <AvatarWithInitials
                                                avatarSrc={request.processed_by.profile}
                                                username={request.processed_by.name}
                                                size="sm"
                                            />
                                            <p>{request.processed_by.name}</p>
                                        </div>
                                    ) : (
                                        <span>None</span>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <p className="mb-2 font-semibold text-muted-foreground">Processed At</p>
                                    {request.processed_at ? <p>{moment(request.processed_at).format('MMMM D, YYYY')}</p> : <span>None</span>}
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <p className="mb-2 font-semibold text-muted-foreground">Approved By</p>
                                <div className="flex flex-wrap gap-2">
                                    {request.approved_by !== null ? (
                                        request.approved_by.map((approvedBy, index) => (
                                            <span key={index} className="text-sm font-bold">
                                                {approvedBy}
                                                {index < request.approved_by.length - 1 && ', '}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-sm font-semibold">None</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mx-auto flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Export this request as a CSV file for reporting, sharing, or backup purposes. The downloaded file will include all
                                relevant request details.
                            </p>
                            <Button
                                onClick={() => downloadSingleRequestCSV(request)}
                                size="sm"
                                variant="outline"
                                className="relative isolate mt-1 gap-2 overflow-hidden border-primary bg-transparent text-primary before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:bg-primary before:transition-transform before:duration-300 before:ease-out hover:bg-transparent hover:text-primary-foreground hover:before:scale-x-100"
                            >
                                <Download size={16} />
                                <span>Export to CSV</span>
                            </Button>
                        </div>
                    </TabsContent>

                    {/* Facilities Tab */}
                    <TabsContent value="facilities" className="mt-6 flex flex-col gap-4 px-6 md:px-8">
                        {/* ── PDF Export button ── */}
                        <div className="flex justify-end">
                            <Button
                                size="sm"
                                variant="outline"
                                className="relative isolate gap-2 overflow-hidden border-primary bg-transparent text-primary before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:bg-primary before:transition-transform before:duration-300 before:ease-out hover:bg-transparent hover:text-primary-foreground hover:before:scale-x-100"
                                onClick={() => downloadFacilitiesPDF(request.title, facilitiesForPDF)}
                            >
                                <Download size={16} />
                                <span>Export Facilities to PDF</span>
                            </Button>
                        </div>

                        {/* ── Booking Cards grid ── */}
                        <div className="flex grid-cols-[1fr_1fr] flex-col gap-4 lg:grid">
                            {request.request_facilities.map((rf, index) => {
                                const facility = request.facilities.find((f) => f.id === rf.facility_id);
                                if (!facility) return null;

                                const ownEquipment =
                                    request.equipment
                                        ?.filter((eq) => !eq.pivot?.is_borrowed && eq.facilities?.some((f) => f.id === rf.facility_id))
                                        .map((eq) => ({
                                            equipment_id: eq.id,
                                            equipment_name: eq.name,
                                            quantity_needed: eq.pivot.quantity_needed,
                                            max_quantity: eq.pivot.quantity_needed,
                                        })) ?? [];

                                const borrowedEquipment =
                                    request.equipment
                                        ?.filter((eq) => eq.pivot?.is_borrowed)
                                        .map((eq) => ({
                                            equipment_id: eq.id,
                                            equipment_name: eq.name,
                                            source_facility_id: eq.pivot.source_facility_id,
                                            source_facility_name: eq.facilities?.find((f) => f.id === eq.pivot.source_facility_id)?.name ?? '',
                                            quantity_needed: eq.pivot.quantity_needed,
                                            max_quantity: eq.pivot.quantity_needed,
                                        })) ?? [];

                                const approvedConflicts =
                                    request.approved_conflicts
                                        ?.filter((c) => c.facility_id === rf.facility_id)
                                        .map((c) => ({
                                            request_id: c.request_id,
                                            request_title: c.request.title,
                                            status: c.request.status,
                                            time_start: c.time_start,
                                            time_end: c.time_end,
                                        })) ?? [];

                                const pendingConflicts =
                                    request.pending_conflicts
                                        ?.filter((c) => c.facility_id === rf.facility_id)
                                        .map((c) => ({
                                            request_id: c.request_id,
                                            request_title: c.request.title,
                                            status: c.request.status,
                                            time_start: c.time_start,
                                            time_end: c.time_end,
                                        })) ?? [];

                                const booking = {
                                    facility_id: rf.facility_id,
                                    facility_name: facility.name,
                                    date: rf.date_requested,
                                    time_start: rf.time_start,
                                    time_end: rf.time_end,
                                    expected_capacity: rf.expected_capacity ?? null,
                                    has_outsiders: rf.has_outsiders ?? false,
                                    equipment: ownEquipment,
                                    borrowed_equipment: borrowedEquipment,
                                    external_equipment: rf.external_equipments?.map((e) => ({ name: e.name })) ?? [],
                                    conflicts: [...approvedConflicts, ...pendingConflicts],
                                    equipment_conflicts: {},
                                    facility_capacity: facility.capacity,
                                    request_facility_status: rf.status ?? null,
                                    request_id: rf.request_id,
                                };

                                return (
                                    <BookingCard key={`${rf.facility_id}-${rf.date_requested}-${rf.time_start}`} booking={booking} index={index} />
                                );
                            })}
                        </div>
                    </TabsContent>

                    {/* Comments Tab */}
                    <TabsContent
                        value="comments"
                        className="relative mt-6 flex w-full flex-col items-start gap-4 px-6 md:grid md:grid-cols-[3fr_4fr] md:px-8"
                    >
                        <div className="order-1 h-full w-full max-w-2xl overflow-y-auto pr-2 pb-32 md:order-2 md:pb-0">
                            <div className="flex flex-col gap-3">
                                {request.comments?.length > 0 ? (
                                    request.comments.map((comment) => <Comment key={comment.id} comment={comment} />)
                                ) : (
                                    <p className="text-sm text-muted-foreground">No comments yet.</p>
                                )}
                            </div>
                        </div>

                        <div className="fixed right-0 bottom-0 left-0 z-50 border-t bg-background p-4 md:sticky md:top-4 md:z-auto md:border-0 md:p-0">
                            <div className="mx-auto flex max-w-2xl flex-col gap-3">
                                <CommentForm requestId={request.id} />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Activity Tab */}
                    <TabsContent value="activity" className="mt-6 flex flex-col gap-4 px-6 md:px-8">
                        {logsLoading ? (
                            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                Loading activity...
                            </div>
                        ) : (
                            <>
                                <ActivityFeed auditLogs={auditLogs} />
                                <SmartPagination currentPage={currentPage} lastPage={lastPage} onPageChange={fetchAuditLogs} />
                            </>
                        )}
                    </TabsContent>

                    {/* Files Tab */}
                    <TabsContent value="files" className="mt-6 px-6 md:px-8">
                        {request.files && request.files.length > 0 ? (
                            <AttachedFileList
                                serverFiles={request.files.map((f) => ({
                                    path: f.path,
                                    original_name: f.path.split('/').pop() ?? f.path,
                                    mime_type: (() => {
                                        const ext = f.path.split('.').pop()?.toLowerCase();
                                        const map: Record<string, string> = {
                                            png: 'image/png',
                                            jpg: 'image/jpeg',
                                            jpeg: 'image/jpeg',
                                            gif: 'image/gif',
                                            webp: 'image/webp',
                                            pdf: 'application/pdf',
                                        };
                                        return map[ext ?? ''] ?? 'application/octet-stream';
                                    })(),
                                    size: 0,
                                    url: `/storage/${f.path}`,
                                }))}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">No files attached.</p>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </DefaultLayout>
    );
}

function CommentForm({ requestId }: { requestId: number }) {
    const [body, setBody] = useState('');

    const submit = () => {
        router.post(
            route('requests.comment', requestId),
            { body },
            {
                onSuccess: () => setBody(''),
                preserveScroll: true,
            },
        );
    };

    return (
        <div className="flex w-full max-w-2xl flex-col gap-3">
            <p className="font-semibold text-muted-foreground">Add a comment</p>
            <Textarea rows={3} className="w-full" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment..." />
            <Button size="sm" variant="secondary" className="self-start" disabled={body.trim().length === 0} onClick={submit}>
                <SendHorizontal size={16} />
                <span>Send</span>
            </Button>
        </div>
    );
}
