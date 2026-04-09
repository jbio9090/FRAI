import { useState } from 'react';
import { router, Link } from '@inertiajs/react';
import { usePermission } from '@/hooks/use-permission';
import { cn, formatTime, recommendedActionToPresentTense } from '@/lib/utils';
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger, } from "@/components/ui/tabs"
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { ArrowUpRight, Calendar, Clock, MessageCircleWarning, ThumbsUp, CheckLine, MessageCirclePlus, User, MessageCircleOff, X, Check, GraduationCap, BookMarked, UsersRound, Landmark, CirclePause, CalendarClock } from 'lucide-react';
import { PRIORITY_LABELS } from '@/types/request';
import { motion } from 'motion/react';
import { Request } from '@/types/request';
import { Button } from './ui/button';
import { Field, FieldDescription } from './ui/field';
import { Textarea } from './ui/textarea';
import moment from 'moment';
import { AttachedFileList } from './attached-file-list';
import AvatarWithInitials from './avatar-with-initials';
import Comment from './comment';
import StatusTag from './status-tag';

export const PRIORITY_ICONS: Record<0 | 1 | 2 | 3, React.ReactNode> = {
    0: <BookMarked size={14} />,
    1: <UsersRound size={14} />,
    2: <GraduationCap size={14} />,
    3: <Landmark size={14} />,
};


export default function RequestCard({
    request,
    page_title,
    handleSelection,
    isSelecting,
    isSelected
}: {
    request: Request;
    page_title: string;
    handleSelection: (id: number) => void;
    isSelecting: boolean;
    isSelected: boolean;
}) {
    const { hasPermission } = usePermission();
    const [isCommentInputOpen, setCommentInputState] = useState(false);
    const [comment, setComment] = useState("");

    const toggleInput = () => {
        setCommentInputState(prev => !prev);
        setComment("");
    }

    const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setComment(e.target.value);
    }

    const handleAction = (action: string) => {
        if (action === 'hold') {
            router.post(route('requests.hold', request.id));
            return;
        }
        if (action === 'comment') {
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
            comment: comment.length > 0 ? comment : null,
        });
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
                duration: 0.4,
                scale: { type: "tween", visualDuration: 0.05 },
            }}
            onClick={() => isSelecting && handleSelection(request.id)}
            className={cn(
                "border rounded-lg p-8 h-content min-h-0 mx-auto w-full transition-all duration-200",
                isSelecting && "cursor-pointer hover:border-primary/50",
                isSelected && "border-primary ring-1 ring-primary"
            )}
        >
            <div className={cn("flex justify-between items-start w-full flex-col gap-6", isSelecting && "pointer-events-none")}>
                <div className="flex justify-around w-full">
                    <div className='flex flex-col gap-1'>
                        <h3 className="font-bold">{request.title}</h3>

                        <div className="flex gap-2 flex-wrap">
                            <StatusTag requestStatus={request.status} />

                            {(request.priority_level > 0) && (
                                <div className="flex gap-1 px-2 py-1 font-semibold text-xs border-border border-1 rounded-full">
                                    {PRIORITY_ICONS[request.priority_level as 0 | 1 | 2]}
                                    <span>
                                        {PRIORITY_LABELS[request.priority_level]}
                                    </span>
                                </div>
                            )}

                            {request.on_hold && (
                                <div className="px-2 py-1 font-semibold text-xs text-yellow-900 dark:text-yellow-100 border-yellow-900 dark:border-yellow-200 border-1 rounded-full flex gap-1 items-center bg-yellow-200/50">
                                    <CirclePause size={14} />
                                    <span>
                                        On Hold
                                    </span>
                                </div>
                            )}
                        </div>


                        <p className="mt-2 text-foreground/70 text-sm">{request.description}</p>

                        <div className="text-sm mt-4 flex gap-2 items-center">
                            <AvatarWithInitials
                                username={request.user.name}
                                avatarSrc={request.user.profile}
                                size='sm'
                            />
                            <span className='text-sm'>{request.user.name}</span>
                            <p className="text-sm text-muted-foreground">
                                Submitted {moment(request.updated_at).fromNow()}
                            </p>
                        </div>
                    </div>

                    <Link href={route("requests.detail", request.id)} className='flex-0 ml-auto mr-0'>
                        <Button size="xs" variant="outline">
                            <ArrowUpRight />
                        </Button>
                    </Link>
                </div>

                <RequestDetails request={request} />

                {request.files?.length > 0 && (
                    <div className="w-full">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Attachments</p>
                        <AttachedFileList serverFiles={request.files} />
                    </div>
                )}

                {(hasPermission('approve requests') && ["Pending", "For Reschedule"].includes(request.status)) && (
                    <div className="flex flex-col w-full">
                        <div className="flex items-center">
                            <div className="flex flex-col">
                                <span className='text-xs font-semibold text-muted-foreground'>Recommendation</span>
                                <span className={cn('font-black ', request.recommended_action === "Denied" && " text-destructive")}>
                                    {recommendedActionToPresentTense(request.recommended_action)}
                                </span>
                            </div>

                            <div className="flex justify-end gap-2 w-content ml-auto">
                                <Button onClick={() => handleAction("approve")} variant="default" className='hidden xs:block'>
                                    Approve
                                </Button>
                                <Button onClick={() => handleAction("reject")} variant="outline" className='hidden xs:block hover:border-destructive hover:text-destructive hover:bg-destructive/4'>
                                    Deny
                                </Button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline">
                                            <span className="hidden xs:block">
                                                More
                                            </span>
                                            <span className="block xs:hidden">
                                                Actions
                                            </span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuGroup className='*:cursor-pointer'>
                                            <DropdownMenuItem onClick={() => handleAction("approve")} className="flex items-center xs:hidden">
                                                <Check size={16} />
                                                <span>Approve</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAction("reject")} className="flex items-center xs:hidden">
                                                <X size={16} />
                                                <span>Deny</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAction("conditionally_approve")}>
                                                <CheckLine size={16} />
                                                <span>Conditionally Approve</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAction("for_reschedule")}>
                                                <CalendarClock size={16} />
                                                <span>Mark for Reschedule</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={toggleInput}>
                                                {isCommentInputOpen ? <MessageCircleOff size={16} /> : <MessageCirclePlus size={16} />}
                                                <span>{isCommentInputOpen ? "Cancel Comment" : "Add Comment"}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAction("hold")}>
                                                <CirclePause size={16} />
                                                <span>{request.on_hold ? "Unhold Request" : "Hold Request"}</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {isCommentInputOpen && (
                            <Field className="flex mt-8">
                                <FieldDescription>Specify your reason for your action</FieldDescription>
                                <Textarea rows={3} className='w-full' onChange={handleCommentChange} />
                            </Field>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
}


function RequestDetails({ request }: { request: Request }) {
    const isPending: boolean = request.status === "Pending";
    const [activeTab, setActiveTab] = useState("facilities");

    const tabs = [
        {
            value: "facilities",
            icon: <Calendar size={16} />,
            label: "Facilities",
            badge: request.facilities.length,
            content: (
                <div className='flex flex-col gap-3 mt-4'>
                    {request.request_facilities.map((rf) => {
                        const facility = request.facilities.find(f => f.id === rf.facility_id);

                        const pendingConflicts = request.pending_conflicts?.filter(
                            c => c.facility_id === rf.facility_id
                        ) ?? [];
                        const approvedConflicts = request.approved_conflicts?.filter(
                            c => c.facility_id === rf.facility_id
                        ) ?? [];

                        return (
                            <div
                                className='flex flex-col text-sm border border-border rounded-lg overflow-hidden'
                                key={rf.date_requested + rf.time_start}
                            >
                                <div className="px-3 py-2.5 flex flex-col gap-1">
                                    <Link href={route("facility.detail", [rf.facility_id])} className='hover:underline'>
                                        <span className='font-semibold'>{facility?.name}</span>
                                    </Link>

                                    {facility?.capacity < rf.expected_capacity && (
                                        <div className="self-start py-0.5 px-2 text-xs border rounded-full text-amber-600 border-amber-600 dark:border-amber-400 dark:text-amber-400 bg-amber-500/10">
                                            Capacity Exceeded
                                        </div>
                                    )}

                                    <div className="flex items-center flex-wrap gap-x-2 text-foreground/70 font-medium">
                                        <div className="flex gap-1 items-center">
                                            <Calendar size={12} />
                                            <span>{moment(rf.date_requested).format("MMM D, YYYY")}</span>
                                        </div>
                                        <div className="flex gap-1 items-center">
                                            <Clock size={12} />
                                            <span>{formatTime(rf.time_start)} – {formatTime(rf.time_end)}</span>
                                        </div>
                                        {rf.expected_capacity && (
                                            <div className="flex gap-1 items-center">
                                                <User size={12} />
                                                <span>{rf.expected_capacity} attendees</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {pendingConflicts.length > 0 && (
                                    <div className="border-t border-border px-3 py-2 flex flex-col gap-1.5">
                                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                            Pending conflicts
                                        </p>
                                        {pendingConflicts.map((conflict) => (
                                            <div key={conflict.id} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                                                <Link
                                                    href={route("requests.detail", conflict.request.id)}
                                                    className="hover:underline truncate font-medium text-foreground"
                                                >
                                                    {conflict.request.title}
                                                </Link>
                                                <span className="shrink-0 flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {formatTime(conflict.time_start)} – {formatTime(conflict.time_end)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {approvedConflicts.length > 0 && (
                                    <div className="border-t border-border px-3 py-2 flex flex-col gap-1.5">
                                        <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                            Approved conflicts
                                        </p>
                                        {approvedConflicts.map((conflict) => (
                                            <div key={conflict.id} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                                                <Link
                                                    href={route("requests.detail", conflict.request.id)}
                                                    className="hover:underline truncate font-medium text-foreground"
                                                >
                                                    {conflict.request.title}
                                                </Link>
                                                <span className="shrink-0 flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {formatTime(conflict.time_start)} – {formatTime(conflict.time_end)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ),
        },
        {
            value: "comment",
            icon: <MessageCircleWarning size={16} />,
            label: "Comments",
            badge: request.comments?.length || undefined,
            content: request.comments?.length > 0 ? (
                <div className='flex flex-col gap-3 mt-4'>
                    {request.comments.map((comment) => (
                        <Comment
                            comment={comment}
                            key={comment.id}
                        />
                    ))}
                </div>
            ) : (
                <p className='text-muted-foreground text-sm w-full p-8 text-center'>No comments yet</p>
            ),
        },
        ...(isPending ? [{
            value: "recommend",
            icon: <ThumbsUp size={16} />,
            label: "Recommendation",
            content: (
                <>
                    <p className='font-semibold text-muted-foreground mt-4'>Recommended Action</p>
                    <p className='font-bold'>{request.recommended_action}</p>
                    <p className='text-sm'>{request.recommended_action_reason}</p>
                </>
            ),
        }] : []),
    ];

    return (
        <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full hidden xs:block'>
                <TabsList className="w-full" variant={"line"}>
                    {tabs.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.badge !== undefined && (
                                <span className='flex items-center justify-center bg-secondary text-secondary-foreground h-5 min-w-[20px] px-1 rounded-full text-[10px] font-medium'>{tab.badge}</span>
                            )}
                        </TabsTrigger>
                    ))}
                </TabsList>
                {tabs.map((tab) => (
                    <TabsContent key={tab.value} value={tab.value}>
                        {tab.content}
                    </TabsContent>
                ))}
            </Tabs>

            <div className='w-full block xs:hidden'>
                <Select value={activeTab} onValueChange={setActiveTab}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select view" />
                    </SelectTrigger>
                    <SelectContent>
                        {tabs.map((tab) => (
                            <SelectItem key={tab.value} value={tab.value}>{tab.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {tabs.find(tab => tab.value === activeTab)?.content}
            </div>
        </>
    );
}