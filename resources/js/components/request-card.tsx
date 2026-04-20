import { useState, useEffect } from 'react';
import { router, Link } from '@inertiajs/react';
import { usePermission } from '@/hooks/use-permission';
import { cn, formatTime, recommendedActionToPresentTense } from '@/lib/utils';
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger, } from "@/components/ui/tabs"
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { ArrowUpRight, Calendar, Clock, MessageCircle, ThumbsUp, CheckLine, MessageCirclePlus, User, MessageCircleOff, X, Check, GraduationCap, BookMarked, UsersRound, Landmark, CirclePause, IterationCw, Sparkles } from 'lucide-react';
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
import AnimatedText from './animated-text';
import { BookingCard } from './booking-card';
import { ScrollArea } from './ui/scroll-area';

export const PRIORITY_ICONS: Record<0 | 1 | 2 | 3, React.ReactNode> = {
    0: <BookMarked size={14} />,
    1: <UsersRound size={14} />,
    2: <GraduationCap size={14} />,
    3: <Landmark size={14} />,
};


export default function RequestCard({
    request: initialRequest,
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
    const [request, setRequest] = useState(initialRequest);
    const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(
        !initialRequest.recommended_action
    );

    useEffect(() => {
        if (!isLoadingRecommendation) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(route('request.recommendation', [request.id]), {
                    headers: { 'Accept': 'application/json' },
                });

                if (!res.ok) {
                    console.error('Recommendation endpoint error:', res.status);
                    clearInterval(interval);
                    return;
                }

                const data = await res.json();

                if (data.recommended_action) {
                    setRequest(prev => ({
                        ...prev,
                        recommended_action: data.recommended_action,
                        recommended_action_reason: data.recommended_action_reason,
                    }));
                    setIsLoadingRecommendation(false);
                    clearInterval(interval);
                }
            } catch (e) {
                console.error('Polling error:', e);
                clearInterval(interval);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [request.id, isLoadingRecommendation]);

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
                "border rounded-lg p-8 h-content min-h-0 mx-auto w-full transition-all duration-200 shadow-xs",
                isSelecting && "cursor-pointer hover:border-primary/50",
                isSelected && "border-primary ring-1 ring-primary"
            )}
        >
            <div className={cn("flex justify-between items-start w-full flex-col gap-6", isSelecting && "pointer-events-none")}>
                <div className="flex justify-around w-full">
                    <div className='flex flex-col gap-1'>
                        <h3 className="font-bold text-xl">{request.title}</h3>

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
                                    <span>On Hold</span>
                                </div>
                            )}
                        </div>

                        <p className="mt-2 text-foreground/70 text-sm">{request.description}</p>

                        {(request.approved_by !== null) && (
                            <div className="flex flex-wrap gap-1 text-sm">
                                <span>Approved by</span>
                                {request.approved_by.map((approvedBy, index) => (
                                    <span key={index} className="text-sm font-bold">
                                        {approvedBy}
                                        {index < request.approved_by.length - 1 && ", "}
                                    </span>
                                ))}
                            </div>
                        )}

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

                <RequestDetails request={request} isLoadingRecommendation={isLoadingRecommendation} />

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

                                <div className="w-full overflow-hidden">
                                    {isLoadingRecommendation ? (
                                        <AnimatedText italize={true} />
                                    ) : (
                                        <div className="overflow-hidden">
                                            <motion.span
                                                initial={{ y: "100%" }}
                                                animate={{ y: "0%" }}
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                                className={cn(
                                                    'font-black inline-block',
                                                    request.recommended_action === "Denied" && "text-destructive"
                                                )}
                                            >
                                                {recommendedActionToPresentTense(request.recommended_action)}
                                            </motion.span>
                                        </div>
                                    )}
                                </div>

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
                                            <span className="hidden xs:block">More</span>
                                            <span className="block xs:hidden">Actions</span>
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
                                                <IterationCw size={16} />
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


function RequestDetails({ request, isLoadingRecommendation }: { request: Request; isLoadingRecommendation: boolean }) {
    const isPending: boolean = request.status === "Pending";
    const [activeTab, setActiveTab] = useState("facilities");

    const tabs = [
        {
            value: "facilities",
            icon: <Calendar size={16} />,
            label: "Facilities",
            badge: request.facilities.length,
            content: (
                <ScrollArea className='mt-4 max-h-96'>
                    {request.request_facilities.map((rf) => {
                        const facility = request.facilities.find(f => f.id === rf.facility_id);

                        const pendingConflicts = (request.pending_conflicts ?? [])
                            .filter(c => c.facility_id === rf.facility_id)
                            .map(c => ({
                                request_title: c.request.title,
                                status: "Pending",
                                time_start: c.time_start,
                                time_end: c.time_end,
                            }));

                        const approvedConflicts = (request.approved_conflicts ?? [])
                            .filter(c => c.facility_id === rf.facility_id)
                            .map(c => ({
                                request_title: c.request.title,
                                status: "Approved",
                                time_start: c.time_start,
                                time_end: c.time_end,
                            }));

                        const booking = {
                            facility_id: rf.facility_id,
                            facility_name: facility?.name ?? `Facility #${rf.facility_id}`,
                            date: rf.date_requested,
                            time_start: rf.time_start,
                            time_end: rf.time_end,
                            expected_capacity: rf.expected_capacity ?? null,
                            has_outsiders: rf.has_outsiders ?? false,
                            conflicts: [...pendingConflicts, ...approvedConflicts],
                            equipment: rf.equipment ?? [],
                            borrowed_equipment: rf.borrowed_equipment ?? [],
                            external_equipment: rf.external_equipments ?? [],
                            equipment_conflicts: rf.equipment_conflicts ?? {},
                        };

                        return (
                            <BookingCard
                                key={rf.date_requested + rf.time_start}
                                booking={booking}
                                index={0}
                                className='mt-4'
                            />
                        );
                    })}
                </ScrollArea>
            ),
        },
        {
            value: "comment",
            icon: <MessageCircle size={16} />,
            label: "Comments",
            badge: request.comments?.length || undefined,
            content: request.comments?.length > 0 ? (
                <ScrollArea className='mt-4 max-h-96'>
                    {request.comments.map((comment) => (
                        <Comment comment={comment} key={comment.id} />
                    ))}
                </ScrollArea>
            ) : (
                <p className='text-muted-foreground text-sm w-full p-8 text-center'>No comments yet</p>
            ),
        },
        ...(isPending ? [{
            value: "recommend",
            icon: <ThumbsUp size={16} />,
            label: "Recommendation",
            content: (() => {
                const actionColor: Record<string, string> = {
                    Approve: "text-emerald-600 dark:text-emerald-400",
                    "Conditionally Approve": "text-amber-600 dark:text-amber-400",
                    Deny: "text-destructive",
                    "For Reschedule": "text-blue-600 dark:text-blue-400",
                };

                const verdictColor = actionColor[request.recommended_action ?? ""] ?? "text-foreground";

                return (
                    <div className="mt-4 rounded-xl border border-dashed p-5 flex flex-col gap-3">
                        {isLoadingRecommendation ? (
                            <div className="flex flex-col gap-2">
                                {/* Header: Icon + "Recommendation" */}
                                <div className="flex items-center gap-1.5">
                                    <div className="w-4 h-4 rounded bg-muted animate-pulse" />
                                    <div className="w-24 h-3.5 rounded bg-muted animate-pulse" />
                                </div>

                                {/* Main Verdict: Centered and Bold-sized */}
                                <div className="h-8 w-48 rounded bg-muted animate-pulse mx-auto" />

                                {/* Reason: Multi-line Centered */}
                                <div className="flex flex-col items-center gap-1.5 px-2">
                                    <div className="h-3 w-full rounded bg-muted animate-pulse" />
                                    <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
                                </div>
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, ease: "easeOut" }}
                                className="flex flex-col gap-2"
                            >
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Sparkles size={15} />
                                    <span className="text-sm">Recommendation</span>
                                </div>

                                <p className={cn("text-2xl font-bold text-center", verdictColor)}>
                                    {request.recommended_action}
                                </p>

                                {request.recommended_action_reason && (
                                    <p className="text-sm text-muted-foreground leading-relaxed px-2 text-center">
                                        {request.recommended_action_reason}
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </div>
                );
            })(),
        }] : []),
    ];

    return (
        <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className='w-full hidden xs:block'>
                <TabsList className="w-fit" variant={"line"}>
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