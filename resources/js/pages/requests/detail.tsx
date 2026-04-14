import {
    Calendar,
    Clock,
    SendHorizontal,
    Pen,
    CheckCircle,
    XCircle,
    ClipboardCheck,
    MessageSquare,
    Sparkles,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import DefaultLayout from '@/layout.tsx/default.';
import { Request } from '@/types/request';
import { Link, usePage } from '@inertiajs/react';
import moment from 'moment';
import AvatarWithInitials from '@/components/avatar-with-initials';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Textarea } from '@/components/ui/textarea';
import Comment from '@/components/comment';
import StatusTag from '@/components/status-tag';
import { ActivityFeed } from '@/components/activity-feed';
import { usePermission } from '@/hooks/use-permission';
import { BookingCard } from '@/components/booking-card';
import { cn } from '@/lib/utils';
import AnimatedText from '@/components/animated-text';

interface DetailProps {
    children?: React.ReactNode;
    request: Request;
    auditLogs: any[];
}

type RecommendedAction = 'Approved' | 'Conditionally Approved' | 'Denied' | 'For Reschedule' | string;

function RecommendationBadge({ action }: { action: RecommendedAction }) {
    const map: Record<string, { className: string; icon: React.ReactNode }> = {
        approved: {
            className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
            icon: <CheckCircle className="w-3.5 h-3.5" />,
        },
        'conditionally approved': {
            className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800',
            icon: <ClipboardCheck className="w-3.5 h-3.5" />,
        },
        denied: {
            className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
            icon: <XCircle className="w-3.5 h-3.5" />,
        },
        'for reschedule': {
            className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
            icon: <Calendar className="w-3.5 h-3.5" />,
        },
    };

    const key = action.toLowerCase();
    const style = map[key] ?? {
        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
        icon: <Sparkles className="w-3.5 h-3.5" />,
    };

    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border',
            style.className
        )}>
            {style.icon}
            {action}
        </span>
    );
}

export default function RequestDetail({ request, auditLogs }: DetailProps) {
    const auth = usePage().props.auth;
    const [comment, setComment] = useState("");
    const [isCommenting, setCommentInputState] = useState(false);
    const { hasRole } = usePermission();
    const isAdmin = hasRole("admin");

    const canEdit = request.status === 'Pending'
        && !request.on_hold
        && request.user.id === auth.user.id;

    const canReschedule = request.status === 'For Reschedule'
        && request.user.id === auth.user.id;

    const handleAction = (action: string) => {
        if (action === 'hold') {
            router.post(route('requests.hold', request.id));
            return;
        }

        if (action === 'comment') {
            if (comment.trim().length === 0) return;
            router.post(route('requests.updateStatus', request.id), {
                action: 'comment',
                comment: comment.trim(),
            }, {
                onSuccess: () => {
                    setComment("");
                    setCommentInputState(false);
                },
            });
            return;
        }

        router.post(route('requests.updateStatus', request.id), {
            action,
            comment: comment.trim().length > 0 ? comment.trim() : null,
        });
    };

    const isPending = request.status === 'Pending' || request.status === 'For Reschedule';

    return (
        <DefaultLayout>
            <div className="flex flex-col w-full gap-4 *:text-sm">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <h1 className='font-bold text-xl'>{request.title}</h1>
                        {canEdit && (
                            <Link href={route("requests.edit", request.id)}>
                                <Button variant={"ghost"} size={"icon-sm"}>
                                    <Pen className="h-4 w-4" />
                                </Button>
                            </Link>
                        )}
                        {canReschedule && (
                            <Link href={route("requests.edit", request.id)}>
                                <Button variant={"outline"} size={"sm"} className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50">
                                    <Calendar className="h-4 w-4" />
                                    Reschedule
                                </Button>
                            </Link>
                        )}
                    </div>

                    <StatusTag requestStatus={request.status} />

                    {isAdmin && (
                        <div className="flex flex-col w-full max-w-2xl mt-2">
                            <div className="flex items-center">
                                <div className="flex flex-col text-sm ">
                                    <span className="font-semibold text-muted-foreground">
                                        Recommendation
                                    </span>
                                    {request.recommended_action ? (
                                        <>
                                            <span className={cn(
                                                'font-black text-lg',
                                                request.recommended_action === 'Denied' && 'text-destructive'
                                            )}>
                                                {request.recommended_action}
                                            </span>
                                            {request.recommended_action_reason && (
                                                <p className="text-muted-foreground mt-0.5 max-w-sm">
                                                    {request.recommended_action_reason}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <AnimatedText italize={true} />
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 ml-auto self-start">
                                    <Button
                                        size="sm"
                                        className="hidden xs:block"
                                        onClick={() => handleAction('approve')}
                                    >
                                        Approve
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="hidden xs:block hover:border-destructive hover:text-destructive hover:bg-destructive/5"
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
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('approve')}
                                                    className="xs:hidden"
                                                >
                                                    <span>Approve</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleAction('reject')}
                                                    className="xs:hidden"
                                                >
                                                    <span>Deny</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAction('conditionally_approve')}>
                                                    Conditionally Approve
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAction('for_reschedule')}>
                                                    Mark for Reschedule
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setCommentInputState(p => !p)}>
                                                    {isCommenting ? 'Cancel Note' : 'Add Note'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAction('hold')}>
                                                    Hold Request
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {isCommenting && (
                                <div className="flex flex-col gap-2 mt-3">
                                    <Textarea
                                        placeholder="Add an optional reason or note..."
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        rows={2}
                                        className="w-full bg-muted/30 text-sm resize-none"
                                    />
                                    {comment.trim().length > 0 && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="self-start"
                                            onClick={() => handleAction('comment')}
                                        >
                                            Post Note
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <Tabs defaultValue="overview" className="mt-4 w-full">
                    <TabsList variant={"line"}>
                        <TabsTrigger value="overview">Overview</TabsTrigger>

                        <TabsTrigger value="facilities" className="flex items-center gap-2">
                            <span>Facilities</span>
                            <span className="flex items-center justify-center bg-secondary text-secondary-foreground h-5 min-w-[20px] px-1 rounded-full text-[10px] font-medium">
                                {request.facilities.length}
                            </span>
                        </TabsTrigger>

                        <TabsTrigger value="comments" className="flex items-center gap-2">
                            <span>Comments</span>
                            <span className="flex items-center justify-center bg-secondary text-secondary-foreground h-5 min-w-[20px] px-1 rounded-full text-[10px] font-medium">
                                {request.comments.length}
                            </span>
                        </TabsTrigger>

                        <TabsTrigger value="activity" className="flex items-center gap-2">
                            <span>Activity</span>
                            <span className="flex items-center justify-center bg-secondary text-secondary-foreground h-5 min-w-[20px] px-1 rounded-full text-[10px] font-medium">
                                {auditLogs.length}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="flex flex-col gap-6 mt-6">
                        <div className="flex flex-col max-w-full">
                            <p className='font-semibold mb-2 text-muted-foreground'>Description</p>
                            <p>{request.description ? request.description : "No Description Provided"}</p>
                        </div>

                        <div className="flex flex-wrap gap-12">
                            <div className="flex flex-col">
                                <p className='font-semibold mb-2 text-muted-foreground'>Requested by</p>
                                <div className="flex gap-2 items-center">
                                    <AvatarWithInitials avatarSrc={request.user.profile} username={request.user.name} size='sm' />
                                    <p>{request.user.name}</p>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <p className='font-semibold mb-2 text-muted-foreground'>Date Submitted</p>
                                <p>{moment(request.created_at).format("MMMM D, YYYY")}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-12">
                            <div className="flex flex-col">
                                <p className='font-semibold mb-2 text-muted-foreground'>Processed by</p>
                                {request.processed_by ? (
                                    <div className="flex gap-2 items-center">
                                        <AvatarWithInitials avatarSrc={request.processed_by.profile} username={request.processed_by.name} size='sm' />
                                        <p>{request.processed_by.name}</p>
                                    </div>
                                ) : (<span>None</span>)}
                            </div>
                            <div className="flex flex-col">
                                <p className='font-semibold mb-2 text-muted-foreground'>Processed At</p>
                                {request.processed_at ? (
                                    <p>{moment(request.processed_at).format("MMMM D, YYYY")}</p>
                                ) : (<span>None</span>)}
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <p className='font-semibold mb-2 text-muted-foreground'>Approved By</p>
                            <div className="flex flex-wrap gap-2">
                                {request.approved_by !== null ? (
                                    request.approved_by.map((approvedBy, index) => (
                                        <span key={index} className="text-sm font-bold">
                                            {approvedBy}
                                            {index < request.approved_by.length - 1 && ", "}
                                        </span>
                                    ))
                                ) : (
                                    <span className='text-sm font-semibold'>None</span>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* Facilities Tab */}
                    <TabsContent value="facilities" className="flex flex-col gap-4 mt-6 lg:grid grid-cols-[1fr_1fr]">
                        {request.request_facilities.map((rf, index) => {
                            const facility = request.facilities.find(f => f.id === rf.facility_id);
                            if (!facility) return null;

                            const ownEquipment = request.equipment
                                ?.filter(eq => !eq.pivot?.is_borrowed && eq.facilities?.some(f => f.id === rf.facility_id))
                                .map(eq => ({
                                    equipment_id: eq.id,
                                    equipment_name: eq.name,
                                    quantity_needed: eq.pivot.quantity_needed,
                                    max_quantity: eq.pivot.quantity_needed,
                                })) ?? [];

                            const borrowedEquipment = request.equipment
                                ?.filter(eq => eq.pivot?.is_borrowed)
                                .map(eq => ({
                                    equipment_id: eq.id,
                                    equipment_name: eq.name,
                                    source_facility_id: eq.pivot.source_facility_id,
                                    source_facility_name: eq.facilities?.find(f => f.id === eq.pivot.source_facility_id)?.name ?? '',
                                    quantity_needed: eq.pivot.quantity_needed,
                                    max_quantity: eq.pivot.quantity_needed,
                                })) ?? [];

                            const approvedConflicts = request.approved_conflicts
                                ?.filter(c => c.facility_id === rf.facility_id)
                                .map(c => ({
                                    request_title: c.request.title,
                                    status: c.request.status,
                                    time_start: c.time_start,
                                    time_end: c.time_end,
                                })) ?? [];

                            const pendingConflicts = request.pending_conflicts
                                ?.filter(c => c.facility_id === rf.facility_id)
                                .map(c => ({
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
                                external_equipment: rf.external_equipments?.map(e => ({ name: e.name })) ?? [],
                                conflicts: [...approvedConflicts, ...pendingConflicts],
                                equipment_conflicts: {},
                            };

                            return (
                                <BookingCard
                                    key={`${rf.facility_id}-${rf.date_requested}-${rf.time_start}`}
                                    booking={booking}
                                    index={index}
                                />
                            );
                        })}
                    </TabsContent>

                    {/* Comments Tab */}
                    <TabsContent
                        value="comments"
                        className="mt-6 w-full relative flex flex-col items-start md:grid md:grid-cols-[3fr_4fr] gap-4"
                    >
                        <div className="order-1 md:order-2 w-full max-w-2xl h-full overflow-y-auto pr-2 pb-32 md:pb-0">
                            <div className="flex flex-col gap-3">
                                {request.comments?.length > 0 ? (
                                    request.comments.map((comment) => (
                                        <Comment key={comment.id} comment={comment} />
                                    ))
                                ) : (
                                    <p className="text-muted-foreground text-sm">No comments yet.</p>
                                )}
                            </div>
                        </div>

                        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t p-4 md:sticky md:top-4 md:z-auto md:p-0 md:border-0">
                            <div className="max-w-2xl mx-auto flex flex-col gap-3">
                                <CommentForm requestId={request.id} />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Activity Tab */}
                    <TabsContent value="activity" className="flex flex-col gap-0 mt-6">
                        <ActivityFeed auditLogs={auditLogs} />
                    </TabsContent>
                </Tabs>
            </div>
        </DefaultLayout>
    );
}

function CommentForm({ requestId }: { requestId: number }) {
    const [body, setBody] = useState("");

    const submit = () => {
        router.post(route('requests.comment', requestId), { body }, {
            onSuccess: () => setBody(""),
            preserveScroll: true,
        });
    };

    return (
        <div className="flex flex-col gap-3 w-full max-w-2xl">
            <p className="font-semibold text-muted-foreground">Add a comment</p>
            <Textarea
                rows={3}
                className="w-full"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a comment..."
            />
            <Button
                size="sm"
                variant="secondary"
                className="self-start"
                disabled={body.trim().length === 0}
                onClick={submit}
            >
                <SendHorizontal size={16} />
                <span>Send</span>
            </Button>
        </div>
    );
}