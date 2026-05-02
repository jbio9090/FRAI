import { router, Link } from '@inertiajs/react';
import {
    ArrowUpRight,
    Calendar,
    Clock,
    MessageCircle,
    ThumbsUp,
    CheckLine,
    MessageCirclePlus,
    User,
    MessageCircleOff,
    X,
    Check,
    GraduationCap,
    BookMarked,
    UsersRound,
    Landmark,
    CirclePause,
    IterationCw,
    Sparkles,
    Paperclip,
} from 'lucide-react';
import moment from 'moment';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/hooks/use-permission';
import { cn, formatTime, recommendedActionToPresentTense } from '@/lib/utils';
import { PRIORITY_LABELS } from '@/types/request';
import type { Request } from '@/types/request';
import AnimatedText from './animated-text';
import { AttachedFileList } from './attached-file-list';
import AvatarWithInitials from './avatar-with-initials';
import { BookingCard } from './booking-card';
import Comment from './comment';
import StatusTag from './status-tag';
import { Button } from './ui/button';
import { Field, FieldDescription } from './ui/field';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
import { Textarea } from './ui/textarea';

export const PRIORITY_ICONS: Record<0 | 1 | 2 | 3, React.ReactNode> = {
    0: <BookMarked size={14} />,
    1: <UsersRound size={14} />,
    2: <GraduationCap size={14} />,
    3: <Landmark size={14} />,
};

export default function RequestCard({
    request: initialRequest,
    handleSelection,
    isSelecting = false,
    isSelected = false,
    className,
}: {
    request: Request;
    page_title?: string;
    handleSelection?: (id: number) => void;
    isSelecting?: boolean;
    isSelected?: boolean;
    className?: string;
}) {
    const { hasPermission } = usePermission();
    const [isCommentInputOpen, setCommentInputState] = useState(false);
    const [comment, setComment] = useState('');
    const [request, setRequest] = useState(initialRequest);
    const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(!initialRequest.recommended_action);

    useEffect(() => {
        if (!isLoadingRecommendation) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(route('request.recommendation', [request.id]), {
                    headers: { Accept: 'application/json' },
                });

                if (!res.ok) {
                    console.error('Recommendation endpoint error:', res.status);
                    return;
                }

                const data = await res.json();

                if (data.recommended_action) {
                    setRequest((prev) => ({
                        ...prev,
                        recommended_action: data.recommended_action,
                        recommended_action_reason: data.recommended_action_reason,
                    }));
                    setIsLoadingRecommendation(false);
                    clearInterval(interval);
                }
            } catch (e) {
                console.error('Polling error:', e);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [request.id, isLoadingRecommendation]);

    const toggleInput = () => {
        setCommentInputState((prev) => !prev);
        setComment('');
    };

    const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setComment(e.target.value);
    };

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

    return (
        <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.8, height: 0, padding: 0, margin: 0, overflow: 'hidden' }}
            transition={{
                duration: 0.4,
                scale: { type: 'tween', visualDuration: 0.05 },
                layout: { type: 'spring', bounce: 0, duration: 0.4 },
            }}
            onClick={() => isSelecting && handleSelection?.(request.id)}
            className={cn(
                'h-content mx-auto min-h-0 w-full rounded-lg border p-8 shadow-2xs transition-all duration-200',
                className,
                isSelecting && 'cursor-pointer hover:border-primary/50',
                isSelected && 'border-primary ring-1 ring-primary',
            )}
        >
            <div className={cn('flex h-full w-full flex-col items-start gap-6', isSelecting && 'pointer-events-none')}>
                <div className="flex w-full justify-around">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-xl font-semibold tracking-tight">{request.title}</h3>

                        <div className="flex flex-wrap gap-2">
                            <StatusTag requestStatus={request.status} />

                            {request.priority_level > 0 && (
                                <div className="flex gap-1 rounded-full border-1 border-border px-2 py-1 text-xs font-semibold">
                                    {PRIORITY_ICONS[request.priority_level as 0 | 1 | 2]}
                                    <span>{PRIORITY_LABELS[request.priority_level]}</span>
                                </div>
                            )}

                            {request.on_hold && (
                                <div className="flex items-center gap-1 rounded-full border-1 border-yellow-900 bg-yellow-200/50 px-2 py-1 text-xs font-semibold text-yellow-900 dark:border-yellow-200 dark:text-yellow-100">
                                    <CirclePause size={14} />
                                    <span>On Hold</span>
                                </div>
                            )}
                        </div>

                        <p className="mt-2 text-sm text-foreground/70">{request.description}</p>

                        {request.approved_by !== null && (
                            <div className="flex flex-wrap gap-1 text-sm">
                                <span>Approved by</span>
                                {request.approved_by.map((approvedBy, index) => (
                                    <span key={index} className="text-sm font-bold">
                                        {approvedBy}
                                        {index < request.approved_by.length - 1 && ', '}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="mt-4 flex items-center gap-1 text-sm">
                            <AvatarWithInitials username={request.user.name} avatarSrc={request.user.profile} size="sm" />
                            <span className="ml-1 text-sm">{request.user.name}</span>
                            <p className="text-sm text-muted-foreground">submitted {moment(request.updated_at).fromNow()}</p>
                        </div>
                    </div>

                    <Link href={route('requests.detail', request.id)} className="mr-0 ml-auto flex-0">
                        <Button size="xs" variant="outline">
                            <ArrowUpRight />
                        </Button>
                    </Link>
                </div>

                <RequestDetails request={request} isLoadingRecommendation={isLoadingRecommendation} files={request.files} />

                {hasPermission('approve requests') && ['Pending', 'For Reschedule'].includes(request.status) && (
                    <div className="mt-auto mb-0 flex w-full flex-col">
                        <div className="flex items-center">
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-muted-foreground">Recommendation</span>

                                <div className="w-full overflow-hidden">
                                    {isLoadingRecommendation ? (
                                        <AnimatedText italize={true} />
                                    ) : (
                                        <div className="overflow-hidden">
                                            <motion.span
                                                initial={{ y: '100%' }}
                                                animate={{ y: '0%' }}
                                                transition={{ duration: 0.4, ease: 'easeOut' }}
                                                className={cn(
                                                    'inline-block font-black',
                                                    request.recommended_action === 'Denied' && 'text-destructive',
                                                )}
                                            >
                                                {recommendedActionToPresentTense(request.recommended_action)}
                                            </motion.span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="w-content ml-auto flex justify-end gap-2">
                                <Button onClick={() => handleAction('approve')} variant="default" className="hidden xs:block">
                                    Approve
                                </Button>
                                <Button
                                    onClick={() => handleAction('reject')}
                                    variant="outline"
                                    className="hidden hover:border-destructive hover:bg-destructive/4 hover:text-destructive xs:block"
                                >
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
                                        <DropdownMenuGroup className="*:cursor-pointer">
                                            <DropdownMenuItem onClick={() => handleAction('approve')} className="flex items-center xs:hidden">
                                                <Check size={16} />
                                                <span>Approve</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAction('reject')} className="flex items-center xs:hidden">
                                                <X size={16} />
                                                <span>Deny</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAction('conditionally_approve')}>
                                                <CheckLine size={16} />
                                                <span>Conditionally Approve</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAction('for_reschedule')}>
                                                <IterationCw size={16} />
                                                <span>Mark for Reschedule</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={toggleInput}>
                                                {isCommentInputOpen ? <MessageCircleOff size={16} /> : <MessageCirclePlus size={16} />}
                                                <span>{isCommentInputOpen ? 'Cancel Comment' : 'Add Comment'}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleAction('hold')}>
                                                <CirclePause size={16} />
                                                <span>{request.on_hold ? 'Unhold Request' : 'Hold Request'}</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {isCommentInputOpen && (
                            <Field className="mt-8 flex">
                                <FieldDescription>Specify your reason for your action</FieldDescription>
                                <Textarea rows={3} className="w-full" onChange={handleCommentChange} />
                            </Field>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function RequestDetails({
    request,
    isLoadingRecommendation,
    files,
}: {
    request: Request;
    isLoadingRecommendation: boolean;
    files?: typeof request.files;
}) {
    const isPending: boolean = request.status === 'Pending';
    const [activeTab, setActiveTab] = useState('facilities');

    const { hasPermission } = usePermission();
    const tabs = [
        {
            value: 'facilities',
            icon: <Calendar size={16} />,
            label: 'Facilities',
            badge: request.facilities.length,
            content: (
                <ScrollArea className="mt-4 h-96">
                    <div className="flex flex-col gap-2">
                        {request.request_facilities.map((rf) => {
                            const facility = request.facilities.find((f) => f.id === rf.facility_id);

                            const pendingConflicts = (request.pending_conflicts ?? [])
                                .filter((c) => c.facility_id === rf.facility_id)
                                .map((c) => ({
                                    request_id: c.request_id,
                                    request_title: c.request.title,
                                    status: 'Pending',
                                    time_start: c.time_start,
                                    time_end: c.time_end,
                                }));

                            const approvedConflicts = (request.approved_conflicts ?? [])
                                .filter((c) => c.facility_id === rf.facility_id)
                                .map((c) => ({
                                    request_id: c.request_id,
                                    request_title: c.request.title,
                                    status: 'Approved',
                                    time_start: c.time_start,
                                    time_end: c.time_end,
                                }));

                            const booking = {
                                request_id: rf.request_id,
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
                                facility_capacity: facility?.capacity ?? null,
                                request_facility_status: rf.status ?? null,
                            };

                            return <BookingCard key={rf.date_requested + rf.time_start} booking={booking} index={0} className="mt-4" />;
                        })}
                    </div>
                </ScrollArea>
            ),
        },
        {
            value: 'comment',
            icon: <MessageCircle size={16} />,
            label: 'Comments',
            badge: request.comments?.length || undefined,
            content:
                request.comments?.length > 0 ? (
                    <ScrollArea className="mt-4 h-96">
                        {request.comments.map((comment) => (
                            <Comment comment={comment} key={comment.id} />
                        ))}
                        <ScrollBar />
                    </ScrollArea>
                ) : (
                    <p className="w-full p-8 text-center text-sm text-muted-foreground">No comments yet</p>
                ),
        },
        ...(files?.length > 0
            ? [
                  {
                      value: 'attachments',
                      icon: <Paperclip size={16} />,
                      label: 'Attachments',
                      badge: files.length,
                      content: (
                          <ScrollArea className="mt-4 h-96">
                              <AttachedFileList serverFiles={files} />
                              <ScrollBar />
                          </ScrollArea>
                      ),
                  },
              ]
            : []),
        ...(hasPermission('approve requests')
            ? [
                  {
                      value: 'recommend',
                      icon: <ThumbsUp size={16} />,
                      label: 'Recommendation',
                      content: (() => {
                          const actionColor: Record<string, string> = {
                              Approve: 'text-emerald-600 dark:text-emerald-400',
                              'Conditionally Approve': 'text-amber-600 dark:text-amber-400',
                              Deny: 'text-destructive',
                              'For Reschedule': 'text-blue-600 dark:text-blue-400',
                          };

                          const verdictColor = actionColor[request.recommended_action ?? ''] ?? 'text-foreground';

                          return (
                              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed p-5">
                                  {isLoadingRecommendation ? (
                                      <div className="flex flex-col gap-2">
                                          {/* Header: Icon + "Recommendation" */}
                                          <div className="flex items-center gap-1.5">
                                              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                                              <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
                                          </div>

                                          {/* Main Verdict: Centered and Bold-sized */}
                                          <div className="mx-auto h-8 w-48 animate-pulse rounded bg-muted" />

                                          {/* Reason: Multi-line Centered */}
                                          <div className="flex flex-col items-center gap-1.5 px-2">
                                              <div className="h-3 w-full animate-pulse rounded bg-muted" />
                                              <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
                                          </div>
                                      </div>
                                  ) : (
                                      <motion.div
                                          initial={{ opacity: 0, y: 6 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ duration: 0.35, ease: 'easeOut' }}
                                          className="flex flex-col gap-2"
                                      >
                                          <div className="flex items-center gap-1.5 text-muted-foreground">
                                              <Sparkles size={15} />
                                              <span className="text-sm">Recommendation</span>
                                          </div>

                                          <p className={cn('text-center text-2xl font-bold', verdictColor)}>{request.recommended_action}</p>

                                          {request.recommended_action_reason && (
                                              <p className="px-2 text-center text-sm leading-relaxed text-muted-foreground">
                                                  {request.recommended_action_reason}
                                              </p>
                                          )}
                                      </motion.div>
                                  )}
                              </div>
                          );
                      })(),
                  },
              ]
            : []),
    ];

    return (
        <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden w-full xs:block">
                <ScrollArea className="w-full" type="scroll">
                    <TabsList className="w-max min-w-full border-b" variant="line">
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.value} value={tab.value}>
                                {tab.icon}
                                <span>{tab.label}</span>
                                {tab.badge !== undefined && (
                                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-medium text-secondary-foreground">
                                        {tab.badge}
                                    </span>
                                )}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <ScrollBar orientation="horizontal" className="translate-y-2" />
                </ScrollArea>
                {tabs.map((tab) => (
                    <TabsContent key={tab.value} value={tab.value}>
                        {tab.content}
                    </TabsContent>
                ))}
            </Tabs>

            <div className="block w-full xs:hidden">
                <Select value={activeTab} onValueChange={setActiveTab}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select view" />
                    </SelectTrigger>
                    <SelectContent>
                        {tabs.map((tab) => (
                            <SelectItem key={tab.value} value={tab.value}>
                                <span className="flex items-center gap-2">
                                    {tab.icon}
                                    {tab.label}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {tabs.find((tab) => tab.value === activeTab)?.content}
            </div>
        </>
    );
}
