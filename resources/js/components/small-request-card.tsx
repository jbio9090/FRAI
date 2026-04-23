import { useState, useEffect } from 'react';
import { router, Link } from '@inertiajs/react';
import { usePermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
    ArrowUpRight, Calendar, MessageCircle, CheckLine, MessageCirclePlus,
    MessageCircleOff, CirclePause, IterationCw, Paperclip, AlertTriangle,
    BookMarked, UsersRound, GraduationCap, Landmark,
} from 'lucide-react';
import { PRIORITY_LABELS } from '@/types/request';
import { motion } from 'motion/react';
import { Request } from '@/types/request';
import { Button } from './ui/button';
import { Field, FieldDescription } from './ui/field';
import { Textarea } from './ui/textarea';
import moment from 'moment';
import AvatarWithInitials from './avatar-with-initials';
import StatusTag from './status-tag';

const PRIORITY_ICONS: Record<0 | 1 | 2 | 3, React.ReactNode> = {
    0: <BookMarked size={12} />,
    1: <UsersRound size={12} />,
    2: <GraduationCap size={12} />,
    3: <Landmark size={12} />,
};

export default function SmallRequestCard({
    request: initialRequest,
    handleSelection,
    isSelecting = false,
    isSelected = false,
    className,
}: {
    request: Request;
    handleSelection?: (id: number) => void;
    isSelecting?: boolean;
    isSelected?: boolean;
    className?: string;
}) {
    const { hasPermission } = usePermission();
    const [isCommentInputOpen, setCommentInputState] = useState(false);
    const [comment, setComment] = useState("");
    const [request, setRequest] = useState(initialRequest);
    const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(!initialRequest.recommended_action);

    useEffect(() => {
        if (!isLoadingRecommendation) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(route('request.recommendation', [request.id]), {
                    headers: { 'Accept': 'application/json' },
                });
                if (!res.ok) { return; }
                const data = await res.json();
                if (data.recommended_action) {
                    setRequest(prev => ({ ...prev, recommended_action: data.recommended_action, recommended_action_reason: data.recommended_action_reason }));
                    setIsLoadingRecommendation(false);
                    clearInterval(interval);
                }
            } catch (e) {
                console.error('Recommendation polling error:', e);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [request.id, isLoadingRecommendation]);

    const handleAction = (action: string) => {
        if (action === 'hold') { router.post(route('requests.hold', request.id)); return; }
        if (action === 'comment') {
            router.post(route('requests.updateStatus', request.id), { action: 'comment', comment: comment.trim() }, {
                onSuccess: () => { setComment(""); setCommentInputState(false); },
            });
            return;
        }
        router.post(route('requests.updateStatus', request.id), { action, comment: comment.length > 0 ? comment : null });
    };

    const canApprove = hasPermission('approve requests') && ["Pending", "For Reschedule"].includes(request.status);

    const totalConflicts = [
        ...(request.pending_conflicts ?? []),
        ...(request.approved_conflicts ?? []),
    ].length;

    const commentCount = request.comments?.length ?? 0;
    const fileCount = request.files?.length ?? 0;
    const facilityCount = request.facilities?.length ?? 0;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            onClick={() => isSelecting && handleSelection?.(request.id)}
            className={cn(
                "border rounded-lg px-6 py-5 mx-auto w-full transition-all duration-200",
                isSelecting && "cursor-pointer hover:border-primary/50",
                isSelected && "border-primary ring-1 ring-primary",
                className,
            )}
        >
            <div className={cn("flex flex-col gap-3", isSelecting && "pointer-events-none")}>

                {/* Row 1: Title + link button */}
                <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xl leading-tight">{request.title}</span>
                    <Link href={route("requests.detail", request.id)} className="shrink-0 ml-auto">
                        <Button size="xs" variant="outline"><ArrowUpRight size={14} /></Button>
                    </Link>
                </div>

                {/* Row 2: Status + tags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusTag requestStatus={request.status} />

                    {request.priority_level > 0 && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold border rounded-full">
                            {PRIORITY_ICONS[request.priority_level as 0 | 1 | 2 | 3]}
                            {PRIORITY_LABELS[request.priority_level]}
                        </span>
                    )}

                    {request.on_hold && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold text-yellow-900 dark:text-yellow-100 border border-yellow-900 dark:border-yellow-200 rounded-full bg-yellow-200/50">
                            <CirclePause size={11} /> On Hold
                        </span>
                    )}

                    {totalConflicts > 0 && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold text-destructive border border-destructive/40 rounded-full bg-destructive/5">
                            <AlertTriangle size={11} /> {totalConflicts} conflict{totalConflicts !== 1 && "s"}
                        </span>
                    )}
                </div>

                {/* Row 3: Avatar + name/date + meta counts */}
                <div className="flex items-center gap-2 flex-wrap">
                    <AvatarWithInitials
                        username={request.user.name}
                        avatarSrc={request.user.profile}
                        size="sm"
                    />
                    <span className="text-sm">{request.user.name}</span>
                    <span className="text-sm text-muted-foreground">
                        Submitted {moment(request.updated_at).fromNow()}
                    </span>
                </div>


                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Calendar size={12} /> {facilityCount} {facilityCount !== 1 ? "facilities" : "facility"}
                    </span>
                    {commentCount > 0 && (
                        <span className="flex items-center gap-1">
                            <MessageCircle size={12} /> {commentCount} {commentCount !== 1 ? "comments" : "comment"}
                        </span>
                    )}
                    {fileCount > 0 && (
                        <span className="flex items-center gap-1">
                            <Paperclip size={12} /> {fileCount} {fileCount !== 1 ? "files" : "file"}
                        </span>
                    )}
                </div>

                {/* Row 4: Actions (only if canApprove) */}
                {canApprove && (
                    <div className="flex items-center justify-end gap-2 mt-auto mb-0">
                        <Button size="sm" onClick={() => handleAction("approve")}>Approve</Button>
                        <Button size="sm" variant="outline"
                            className="hover:border-destructive hover:text-destructive"
                            onClick={() => handleAction("reject")}>
                            Deny
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline">More</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuGroup className="*:cursor-pointer">
                                    <DropdownMenuItem onClick={() => handleAction("conditionally_approve")}>
                                        <CheckLine size={14} /> Conditionally Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAction("for_reschedule")}>
                                        <IterationCw size={14} /> Mark for Reschedule
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setCommentInputState(p => !p); setComment(""); }}>
                                        {isCommentInputOpen ? <MessageCircleOff size={14} /> : <MessageCirclePlus size={14} />}
                                        {isCommentInputOpen ? "Cancel Comment" : "Add Comment"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAction("hold")}>
                                        <CirclePause size={14} /> {request.on_hold ? "Unhold" : "Hold"} Request
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            {/* Comment input */}
            {isCommentInputOpen && (
                <div className="mt-3">
                    <Field>
                        <FieldDescription>Reason for action</FieldDescription>
                        <Textarea rows={2} className="w-full" onChange={e => setComment(e.target.value)} />
                        <Button size="xs" className="mt-2" onClick={() => handleAction("comment")}>Submit Comment</Button>
                    </Field>
                </div>
            )}
        </motion.div>
    );
}
