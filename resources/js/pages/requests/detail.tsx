import { Link, router, usePage } from '@inertiajs/react';
import { Calendar, Download, Pen, SendHorizontal } from 'lucide-react';
import moment from 'moment';
import { useEffect, useState } from 'react';
import { ActivityFeed, type AuditLog } from '@/components/activity-feed';
import AnimatedText from '@/components/animated-text';
import { AttachedFileList } from '@/components/attached-file-list';
import AvatarWithInitials from '@/components/avatar-with-initials';
import { BookingCard } from '@/components/booking-card';
import Comment from '@/components/comment';
import { downloadFacilitiesPDF } from '@/components/pdf/FacilitiesPDF';
import { RecommendationPanel } from '@/components/request/recommendation-panel';
import SmartPagination from '@/components/SmartPagination';
import StatusTag from '@/components/status-tag';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { downloadSingleRequestCSV } from '@/lib/downloadCSV';
import { clearRichPageContext, setRichPageContext } from '@/lib/richPageContext';
import { cn } from '@/lib/utils';
import { PRIORITY_ACCENT, PRIORITY_LABELS } from '@/types/request';
import type { Request } from '@/types/request';

interface DetailProps {
    children?: React.ReactNode;
    request: Request | null;
    auditLogs: { data: AuditLog[]; current_page: number; last_page: number; total: number } | null;
}

export default function RequestDetail({ request: initialRequest, auditLogs: auditLogsProp }: DetailProps) {
    const auth = usePage().props.auth;
    const [comment, setComment] = useState('');
    const [isCommenting, setCommentInputState] = useState(false);
    const { hasRole } = usePermission();
    const isAdmin = hasRole('admin') || hasRole('Super Admin');

    const [auditLogs, setAuditLogs] = useState(auditLogsProp?.data ?? []);
    const [currentPage, setCurrentPage] = useState(auditLogsProp?.current_page ?? 1);
    const [lastPage, setLastPage] = useState(auditLogsProp?.last_page ?? 1);
    const [totalLogs, setTotalLogs] = useState(auditLogsProp?.total ?? 0);
    const [logsLoading, setLogsLoading] = useState(false);
    const [request, setRequest] = useState(initialRequest);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (!request) {
            clearRichPageContext();
            return;
        }

        setRichPageContext({
            entity: 'request_detail',
            request_id: request.id,
            status: request.status,
            facility_count: request.request_facilities?.length ?? 0,
        });

        return () => {
            clearRichPageContext();
        };
    }, [request?.id, request?.status, request?.request_facilities?.length]);

    useEffect(() => {
        // Sync local activity state when the deferred prop resolves or changes
        if (!auditLogsProp) return;

        try {
            if (Array.isArray(auditLogsProp.data)) {
                setAuditLogs(auditLogsProp.data);
                setCurrentPage(auditLogsProp.current_page ?? 1);
                setLastPage(auditLogsProp.last_page ?? 1);
                setTotalLogs(auditLogsProp.total ?? 0);
            }
        } catch {
            // ignore malformed/deferred shapes until resolved
        }
    }, [auditLogsProp]);

    // Sync local request state when Inertia refreshes the prop after an action
    // (approve, reject, hold, etc.). preserveState: true keeps component state
    // (scroll, tabs, comment text) but leaves this useState stale — this effect
    // bridges that gap without triggering an extra network round-trip.
    useEffect(() => {
        if (!initialRequest) return;
        setRequest(initialRequest);
        if (initialRequest.recommended_action) {
            setIsLoadingRecommendation(false);
        }
        if (!facilitiesNeedPolling(initialRequest)) {
            setIsLoadingFacilityStatuses(false);
        }
    }, [initialRequest]);

    // True while we're still waiting for the AI recommendation to be generated.
    const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(!initialRequest.recommended_action);

    // True while any request_facility still has a null/pending status that we
    // haven't received a definitive value for yet.
    const facilitiesNeedPolling = (req: typeof initialRequest) => req.request_facilities?.some((rf) => rf.status == null) ?? false;
    const [isLoadingFacilityStatuses, setIsLoadingFacilityStatuses] = useState(() => facilitiesNeedPolling(initialRequest));

    const isPollingActive = isLoadingRecommendation || isLoadingFacilityStatuses;
    const refreshRequest = async () => {
        if (!request) return;
        try {
            const res = await fetch(route('request.recommendation', [request.id]), {
                headers: { Accept: 'application/json' },
            });

            if (!res.ok) {
                console.error('Recommendation endpoint error:', res.status);
                return;
            }

            const data = await res.json();

            setRequest((prev) => {
                const mergedFacilities = prev.request_facilities?.map((rf) => {
                    const updated = data.request_facilities?.find((u: { id: number }) => u.id === rf.id);
                    if (!updated) return rf;
                    return {
                        ...rf,
                        status: updated.status ?? rf.status,
                        ai_recommended_status: updated.ai_recommended_status ?? rf.ai_recommended_status,
                        ai_recommendation_reason: updated.ai_recommendation_reason ?? rf.ai_recommendation_reason,
                    };
                });

                return {
                    ...prev,
                    status: data.request_status ?? prev.status,
                    recommended_action: data.recommended_action ?? prev.recommended_action,
                    recommended_action_reason: data.recommended_action_reason ?? prev.recommended_action_reason,
                    request_facilities: mergedFacilities ?? prev.request_facilities,
                };
            });

            if (data.recommended_action) setIsLoadingRecommendation(false);
            if (!facilitiesNeedPolling({ ...request, request_facilities: data.request_facilities ?? request.request_facilities })) {
                setIsLoadingFacilityStatuses(false);
            }
        } catch (e) {
            console.error('Polling error:', e);
        }
    };

    useEffect(() => {
        if (!isPollingActive) return;

        const interval = setInterval(() => {
            void refreshRequest();
        }, 5000);

        return () => clearInterval(interval);
    }, [request.id, isPollingActive]);

    if (!initialRequest || !auditLogsProp) {
        return (
            <DefaultLayout>
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Spinner size="sm" />
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

    return (
        <DefaultLayout hasPadding={false}>
            <div className="flex w-full flex-col gap-4 *:text-sm">
                <div className="flex flex-col gap-3 px-6 pt-6 md:px-8 md:pt-8">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{request.title}</h1>

                        <span
                            className="inline-flex w-fit items-center rounded-[4px] px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
                            style={{
                                backgroundColor: PRIORITY_ACCENT[request.priority_level]?.fill ?? PRIORITY_ACCENT[0].fill,
                                color: PRIORITY_ACCENT[request.priority_level]?.ink ?? PRIORITY_ACCENT[0].ink,
                            }}
                        >
                            {PRIORITY_LABELS[request.priority_level]}
                        </span>

                        <StatusTag requestStatus={request.status} />

                        <div className="ml-auto flex items-center gap-2">
                            {(request.user.id === auth.user.id) && (
                                <Link href={route('requests.edit', request.id)}>
                                    <Button variant="ghost" size="sm" aria-label="Edit request">
                                        <Pen className="h-4 w-4" />
                                        <span>{ canReschedule ? "Reschedule" : "Edit"}</span>
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>

                    {isAdmin && (
                        <div className="ads-card mt-1 flex w-full max-w-3xl flex-col gap-3 p-4">
                            <div className="flex flex-wrap items-start gap-3">
                                <div className="flex min-w-0 flex-col">
                                    <span className="ads-eyebrow">Recommendation</span>
                                    {request.recommended_action ? (
                                        <>
                                            <span
                                                className={cn('mt-0.5 text-lg font-black', request.recommended_action === 'Denied' && 'text-destructive')}
                                            >
                                                {request.recommended_action}
                                            </span>
                                            {request.recommended_action_reason && (
                                                <p className="mt-0.5 max-w-sm text-sm text-muted-foreground">{request.recommended_action_reason}</p>
                                            )}
                                        </>
                                    ) : (
                                        <AnimatedText italize={true} />
                                    )}
                                </div>

                                <div className="ml-auto flex flex-wrap justify-end gap-2 self-start">
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
                                <div className="flex flex-col gap-2 border-t border-border pt-3">
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

                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 w-full">
                    <ScrollArea className="w-full" type="scroll">
                        <TabsList variant="line" className="ml-6 w-fit border-b md:ml-8">
                            <TabsTrigger value="overview">Overview</TabsTrigger>

                            <TabsTrigger value="facilities" className="flex items-center gap-2">
                                <span>Facilities</span>
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-[4px] bg-[var(--ads-neutral-bg)] px-1 text-[10px] font-medium text-[var(--ads-neutral)]">
                                    {request.facilities.length}
                                </span>
                            </TabsTrigger>

                            <TabsTrigger value="comments" className="flex items-center gap-2">
                                <span>Comments</span>
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-[4px] bg-[var(--ads-neutral-bg)] px-1 text-[10px] font-medium text-[var(--ads-neutral)]">
                                    {request.comments.length}
                                </span>
                            </TabsTrigger>

                            <TabsTrigger value="activity" className="flex items-center gap-2">
                                <span>Activity</span>
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-[4px] bg-[var(--ads-neutral-bg)] px-1 text-[10px] font-medium text-[var(--ads-neutral)]">
                                    {totalLogs}
                                </span>
                            </TabsTrigger>

                            <TabsTrigger value="files" className="flex items-center gap-2">
                                <span>Files</span>
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-[4px] bg-[var(--ads-neutral-bg)] px-1 text-[10px] font-medium text-[var(--ads-neutral)]">
                                    {request.files?.length ?? 0}
                                </span>
                            </TabsTrigger>

                            {isAdmin && (
                                <TabsTrigger value="recommendation" className="flex items-center gap-2">
                                    <span>Recommendation</span>
                                </TabsTrigger>
                            )}
                        </TabsList>
                        <ScrollBar orientation="horizontal" className="h-0" />
                    </ScrollArea>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="mt-6 px-6 md:px-8">
                        <div className="flex max-w-3xl flex-col gap-6">
                            {/* Description */}
                            <section className="ads-card p-5 md:p-6">
                                <div className="mb-4 border-b border-border pb-3">
                                    <span className="ads-eyebrow">Description</span>
                                </div>
                                <p className="leading-relaxed text-foreground">{request.description || 'No description provided.'}</p>
                            </section>

                            {/* Request details */}
                            <section className="ads-card p-5 md:p-6">
                                <div className="mb-5 border-b border-border pb-3">
                                    <span className="ads-eyebrow">Request details</span>
                                </div>

                                <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
                                    <div>
                                        <p className="ads-eyebrow mb-1.5">Requested by</p>
                                        <div className="flex items-center gap-1.5">
                                            <AvatarWithInitials avatarSrc={request.user.profile} username={request.user.name} size="sm" />
                                            <span>{request.user.name}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="ads-eyebrow mb-1.5">Date Submitted</p>
                                        <p>{moment(request.created_at).format('MMM D, YYYY')}</p>
                                    </div>

                                    <div>
                                        <p className="ads-eyebrow mb-1.5">Processed by</p>
                                        {request.processed_by ? (
                                            <div className="flex items-center gap-1.5">
                                                <AvatarWithInitials
                                                    avatarSrc={request.processed_by.profile}
                                                    username={request.processed_by.name}
                                                    size="sm"
                                                />
                                                <span>{request.processed_by.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </div>

                                    <div>
                                        <p className="ads-eyebrow mb-1.5">Processed At</p>
                                        {request.processed_at ? (
                                            <p>{moment(request.processed_at).format('MMM D, YYYY')}</p>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </div>

                                    <div className="col-span-2">
                                        <p className="ads-eyebrow mb-1.5">Approved By</p>
                                        {request.approved_by?.length ? (
                                            <p className="font-medium">{request.approved_by.join(', ')}</p>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </div>
                                </div>

                                {/* Export */}
                                <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-4">
                                    <p className="text-xs text-muted-foreground">Export this request as CSV for reporting or backup.</p>
                                    <Button
                                        onClick={() => downloadSingleRequestCSV(request)}
                                        size="sm"
                                        variant="outline"
                                        className="ml-auto shrink-0 gap-2"
                                    >
                                        <Download size={16} />
                                        <span>Export to CSV</span>
                                    </Button>
                                </div>
                            </section>
                        </div>
                    </TabsContent>

                    {/* Facilities Tab */}
                    <TabsContent value="facilities" className="mt-6 flex flex-col gap-4 px-6 md:px-8">
                        {/* ── PDF Export button ── */}
                        <div className="flex justify-end">
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
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
                                        ?.map((c) => ({
                                            request_id: c.request_id,
                                            request_title: c.request?.title ?? 'Unknown',
                                            status: c.request?.status ?? 'Approved',
                                            time_start: c.time_start,
                                            time_end: c.time_end,
                                        })) ?? [];

                                const pendingConflicts =
                                    request.pending_conflicts
                                        ?.filter((c) => c.facility_id === rf.facility_id)
                                        ?.map((c) => ({
                                            request_id: c.request_id,
                                            request_title: c.request?.title ?? 'Unknown',
                                            status: c.request?.status ?? 'Pending',
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
                                    request_facility_id: rf.id,
                                };

                                return (
                                    <BookingCard
                                        key={`${rf.facility_id}-${rf.date_requested}-${rf.time_start}`}
                                        booking={booking}
                                        index={index}
                                        onRefresh={refreshRequest}
                                        className="mt-4"
                                    />
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
                            <div className="ads-card flex flex-col gap-3 p-4">
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
                                <Spinner size="sm" className="size-3.5" />
                                Loading activity...
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="ads-card p-5">
                                    <ActivityFeed auditLogs={auditLogs} />
                                </div>
                                <SmartPagination currentPage={currentPage} lastPage={lastPage} onPageChange={fetchAuditLogs} />
                            </div>
                        )}
                    </TabsContent>

                    {/* Files Tab */}
                    <TabsContent value="files" className="mt-6 px-6 md:px-8">
                        {request.files && request.files.length > 0 ? (
                            <div className="ads-card max-w-2xl p-4">
                                <AttachedFileList
                                    serverFiles={request.files.map((f) => ({
                                        path: f.path,
                                        original_name: f.original_name ?? f.path.split('/').pop() ?? f.path,
                                        mime_type: f.mime_type ?? (() => {
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
                                        size: f.size ?? 0,
                                        url: f.url ?? `/storage/${f.path}`,
                                    }))}
                                />
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No files attached.</p>
                        )}
                    </TabsContent>
                    {/* Recommendation Tab */}
                    {isAdmin && (
                        <TabsContent value="recommendation" className="mt-6 flex flex-col gap-4 px-6 md:px-8">
                            <RecommendationPanel request={request} isLoading={isLoadingRecommendation} variant="page" />
                        </TabsContent>
                    )}
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
        <div className="ads-card flex w-full max-w-2xl flex-col gap-3 p-4">
            <span className="ads-eyebrow">Add a comment</span>
            <Textarea rows={3} className="w-full" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment..." />
            <Button size="sm" variant="secondary" className="self-start" disabled={body.trim().length === 0} onClick={submit}>
                <SendHorizontal size={16} />
                <span>Send</span>
            </Button>
        </div>
    );
}