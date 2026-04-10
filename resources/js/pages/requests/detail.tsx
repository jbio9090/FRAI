import {
    Calendar,
    Clock,
    SendHorizontal,
    Pen,
    CheckCircle,
    XCircle,
    ClipboardCheck,
    MessageSquare,
    ShieldAlert
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

interface DetailProps {
    children?: React.ReactNode;
    request: Request;
    auditLogs: any[];
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

    function formatTime(time: string): string {
        return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }

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
                        <Accordion
                            type="single"
                            collapsible
                            defaultValue={(request.status === 'Pending' || request.status === 'For Reschedule') ? 'admin-panel' : undefined}
                            className="mt-2 w-fit"
                        >
                            <AccordionItem value="admin-panel" className="border rounded-xl bg-muted/40 px-4">
                                <AccordionTrigger className="hover:no-underline py-4">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <ShieldAlert className="h-4 w-4" />
                                        <h3 className="text-sm font-semibold tracking-tight">Admin Controls</h3>
                                    </div>
                                </AccordionTrigger>

                                <AccordionContent className="flex flex-col gap-4 pb-4">
                                    {isCommenting && (
                                        <Textarea
                                            placeholder="Add an optional reason or note for this action..."
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            className="w-full bg-background"
                                            rows={2}
                                        />
                                    )}

                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button size="sm" className="gap-1.5" onClick={() => handleAction('approve')}>
                                            <CheckCircle className="h-4 w-4" /> Approve
                                        </Button>

                                        <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => handleAction('reject')}>
                                            <XCircle className="h-4 w-4" /> Deny
                                        </Button>

                                        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => handleAction('conditionally_approve')}>
                                            <ClipboardCheck className="h-4 w-4" /> Conditionally Approve
                                        </Button>

                                        <Button size="sm" variant="outline" className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => handleAction('for_reschedule')}>
                                            <Calendar className="h-4 w-4" /> Reschedule
                                        </Button>

                                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleAction('hold')}>
                                            <Clock className="h-4 w-4" /> Hold
                                        </Button>

                                        <div className="flex-1" />

                                        <Button
                                            size="sm"
                                            variant={isCommenting ? "secondary" : "ghost"}
                                            className="gap-1.5"
                                            onClick={() => setCommentInputState(p => !p)}
                                        >
                                            <MessageSquare className="h-4 w-4" />
                                            {isCommenting ? 'Cancel Note' : 'Add Note'}
                                        </Button>

                                        {isCommenting && comment.trim().length > 0 && (
                                            <Button size="sm" variant="outline" onClick={() => handleAction('comment')}>
                                                Post Note Only
                                            </Button>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
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
                                <p className='font-semibold mb-2 text-muted-foreground'>Proccesed by</p>
                                {request.processed_by ? (<div className="flex gap-2 items-center">
                                    <AvatarWithInitials avatarSrc={request.processed_by.profile} username={request.processed_by.name} size='sm' />
                                    <p>{request.processed_by.name}</p>
                                </div>) : (<span>None</span>)}
                            </div>
                            <div className="flex flex-col">
                                <p className='font-semibold mb-2 text-muted-foreground'>Processed At</p>
                                {request.processed_at ? (<p>{moment(request.processed_at).format("MMMM D, YYYY")}</p>) : (<span>None</span>)}
                            </div>
                        </div>

                        <div className="flex flex-col">
                            <p className='font-semibold mb-2 text-muted-foreground'>Approved By</p>
                            <div className="flex flex-wrap gap-2">
                                {(request.approved_by !== null) ? (
                                    request.approved_by.map((approvedBy, index) => (
                                        <span key={index} className="text-sm font-bold">
                                            {approvedBy}
                                            {index < request.approved_by.length - 1 && ", "}
                                        </span>
                                    ))
                                ) : (
                                    <span className='text-sm font-semibold'>None</span>
                                )
                                }
                            </div>
                        </div>
                    </TabsContent>

                    {/* Facilities Tab */}
                    <TabsContent value="facilities" className="flex flex-col gap-4 mt-6 lg:grid grid-cols-[1fr_1fr]">
                        {request.request_facilities.map((rf) => {
                            const facility = request.facilities.find(f => f.id === rf.facility_id);
                            if (!facility) return null;

                            const facilityEquipment = request.equipment.filter(eq =>
                                eq.facilities?.some(f => f.id === rf.facility_id)
                            );

                            const date = new Date(rf.date_requested).toLocaleDateString('en-US', {
                                month: 'long', day: 'numeric', year: 'numeric'
                            });

                            return (
                                <div
                                    key={`${rf.facility_id}-${rf.date_requested}-${rf.time_start}`}
                                    className="rounded-xl border border-border bg-card overflow-hidden"
                                >
                                    <div className="px-5 py-4 border-b border-border">
                                        <Link href={route("facility.detail", [facility.id])}>
                                            <h2 className="text-[15px] font-medium hover:underline mb-2">
                                                {facility.name}
                                            </h2>
                                        </Link>
                                        <div className="flex flex-wrap gap-3">
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted border border-border rounded-full px-2.5 py-1">
                                                <Calendar size={12} />
                                                {date}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted border border-border rounded-full px-2.5 py-1">
                                                <Clock size={12} />
                                                {formatTime(rf.time_start)} – {formatTime(rf.time_end)}
                                            </span>
                                        </div>
                                    </div>

                                    {facilityEquipment.length > 0 && (
                                        <div className="px-5 py-4">
                                            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
                                                Equipment
                                            </p>
                                            <div className="flex flex-col divide-y divide-border">
                                                {facilityEquipment.map((eq) => (
                                                    <div key={eq.id} className="flex justify-between items-center py-2 text-sm">
                                                        <span>{eq.name}</span>
                                                        <span className="text-xs text-muted-foreground bg-muted rounded px-2 py-0.5">
                                                            Qty: {eq.pivot.quantity_needed}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {rf.external_equipments?.length > 0 && (
                                        <div className="px-5 py-4 border-t border-border">
                                            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
                                                External equipment
                                            </p>
                                            <div className="flex flex-col divide-y divide-border">
                                                {rf.external_equipments.map((item, i) => (
                                                    <div key={i} className="text-sm py-2">{item.name}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {request.approved_conflicts?.filter(c => c.facility_id === rf.facility_id).length > 0 && (
                                        <div className="px-5 py-4 border-t border-border">
                                            <p className="text-[11px] font-medium uppercase tracking-widest text-red-600 dark:text-red-400 mb-3">
                                                Approved conflicts
                                            </p>
                                            <div className="flex flex-col divide-y divide-border">
                                                {request.approved_conflicts
                                                    .filter(c => c.facility_id === rf.facility_id)
                                                    .map((conflict) => (
                                                        <div key={conflict.id} className="flex flex-col gap-1 py-2.5 text-sm">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <Link
                                                                    href={route("requests.detail", conflict.request.id)}
                                                                    className="font-medium hover:underline truncate"
                                                                >
                                                                    {conflict.request.title}
                                                                </Link>
                                                                <Badge variant="destructive" className="shrink-0 text-[10px]">
                                                                    {conflict.request.status}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar size={11} />
                                                                    {new Date(conflict.date_requested).toLocaleDateString('en-US', {
                                                                        month: 'long', day: 'numeric', year: 'numeric'
                                                                    })}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <Clock size={11} />
                                                                    {formatTime(conflict.time_start)} – {formatTime(conflict.time_end)}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                By {conflict.request.user.name}
                                                            </p>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}

                                    {request.pending_conflicts?.filter(c => c.facility_id === rf.facility_id).length > 0 && (
                                        <div className="px-5 py-4 border-t border-border">
                                            <p className="text-[11px] font-medium uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-3">
                                                Pending conflicts
                                            </p>
                                            <div className="flex flex-col divide-y divide-border">
                                                {request.pending_conflicts
                                                    .filter(c => c.facility_id === rf.facility_id)
                                                    .map((conflict) => (
                                                        <div key={conflict.id} className="flex flex-col gap-1 py-2.5 text-sm">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <Link
                                                                    href={route("requests.detail", conflict.request.id)}
                                                                    className="font-medium hover:underline truncate"
                                                                >
                                                                    {conflict.request.title}
                                                                </Link>
                                                                <Badge variant="outline" className="shrink-0 text-[10px]">
                                                                    {conflict.request.status}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar size={11} />
                                                                    {new Date(conflict.date_requested).toLocaleDateString('en-US', {
                                                                        month: 'long', day: 'numeric', year: 'numeric'
                                                                    })}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <Clock size={11} />
                                                                    {formatTime(conflict.time_start)} – {formatTime(conflict.time_end)}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                By {conflict.request.user.name}
                                                            </p>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
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
                                    <p className="text-muted-foreground text-sm">
                                        No comments yet.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div
                            className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t p-4 md:sticky md:top-4 md:z-auto md:p-0 md:border-0"
                        >
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