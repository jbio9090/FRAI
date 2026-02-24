import { router, Link } from '@inertiajs/react';
import { ArrowUpRight, Calendar, Clock, MessageCircleWarning, ThumbsUp, CheckLine, MessageCirclePlus, MessageCircleOff, MousePointer2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger, } from "@/components/ui/tabs"
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import moment from 'moment';
import { Request, RequestsPageProps } from '@/types/request';
import { cn, formatTime, recommendedActionToPresentTense } from '@/lib/utils';
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, } from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { Field, FieldDescription } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';


export default function RequestsPage({ requests, page_title }: RequestsPageProps) {
    const [selected, setSelected] = useState<number[]>([]);
    const [isSelecting, setSelectState] = useState<boolean>(false);
    const [bulkComment, setBulkComment] = useState("");
    const [isBulkCommentOpen, setIsBulkCommentOpen] = useState(false);

    const handleSelection = (request_id: number) => {
        setSelected((prev) =>
            prev.includes(request_id)
                ? prev.filter((id) => id !== request_id)
                : [...prev, request_id]
        );
    };

    const clearAllSelection = () => {
        setSelected([]);
    }

    const selectAllSelection = () => {
        setSelected(requests.map((req) => req.id));
    }

    const toggleSelection = () => {
        setSelectState(!isSelecting);
        if (isSelecting) setSelected([]);
    }

    const bulkAction = (action: string) => {
        router.post(route('bulk.action'), {
            ids: selected,
            action,
            comment: bulkComment.length > 0 ? bulkComment : null,
        }, {
            onSuccess: () => {
                setSelected([]);
                setSelectState(false);
                setBulkComment("");
                setIsBulkCommentOpen(false);
            },
        });
    };

    return (
        <DefaultLayout>
            <div className="max-w-6xl mx-auto w-full">
                <h1 className="text-xl font-bold mb-6">{page_title} Requests</h1>
                <div className="flex flex-col justify-center w-full mt-4 mb-4 flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <Button
                            size={"sm"}
                            variant={"outline"}
                            onClick={toggleSelection}
                            className={cn(isSelecting ? "text-primary border-primary bg-primary/5" : "")}
                        >
                            <MousePointer2 size={16} />
                            <span>{!isSelecting ? "Bulk Action" : "Stop Selection"}</span>
                        </Button>

                        {(!(selected.length >= requests.length) && (isSelecting)) && (
                            <Button
                                size={"sm"}
                                variant={"outline"}
                                onClick={selectAllSelection}
                            >
                                <MousePointer2 size={16} />
                                <span>Select All</span>
                            </Button>
                        )}

                        {(selected.length > 0 && (
                            <Button
                                size={"sm"}
                                variant={"outline"}
                                onClick={clearAllSelection}
                            >
                                <X size={16} />
                                <span>Clear</span>
                            </Button>
                        ))}

                        <Separator orientation='vertical' />

                        {isSelecting && selected.length > 0 && (
                            <span className="ml-4 text-sm font-medium">
                                {selected.length} selected
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {selected.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => bulkAction('approve')}>
                                <Check size={16} />
                                <span>Approve</span>
                            </Button>
                        )}

                        {selected.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => bulkAction('reject')}>
                                <X size={16} />
                                <span>Deny</span>
                            </Button>
                        )}

                        {selected.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => bulkAction('conditionally_approve')}>
                                <CheckLine size={16} />
                                <span>Conditionally Approve</span>
                            </Button>
                        )}

                        {selected.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => setIsBulkCommentOpen(p => !p)}>
                                {isBulkCommentOpen ? <MessageCircleOff className="mr-2 h-4 w-4" /> : <MessageCirclePlus className="mr-2 h-4 w-4" />}
                                <span>{isBulkCommentOpen ? "Cancel Comment" : "Add Comment"}</span>
                            </Button>
                        )}
                    </div>
                </div>

                {selected.length > 0 && isBulkCommentOpen && (
                    <div className="w-full mt-2">
                        <Field>
                            <FieldDescription>Comment to attach to all selected requests</FieldDescription>
                            <Textarea
                                rows={3}
                                className="w-full"
                                value={bulkComment}
                                onChange={(e) => setBulkComment(e.target.value)}
                            />
                        </Field>
                    </div>
                )}


                <div className="gap-4 mt-8 flex flex-col xl:grid grid-cols-[1fr_1fr]">
                    {requests.map((request) => (
                        <RequestCard
                            request={request}
                            page_title={page_title}
                            key={request.id}
                            isSelecting={isSelecting}
                            isSelected={selected.includes(request.id)}
                            handleSelection={handleSelection}
                        />
                    ))}
                </div>
            </div>
        </DefaultLayout>
    );
}


function RequestCard({
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

    const handleAction = (route_name: string) => {
        router.post(route(route_name, request.id), { comment: (comment.length > 0) ? comment : null });
    }

    return (
        <div
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
                        <p className="mt-2 text-foreground/70 text-sm">{request.description}</p>

                        <div className="text-sm mt-4 flex gap-2 items-center">
                            <Avatar size='sm'>
                                <AvatarImage src='/profile/default.png' />
                            </Avatar>
                            <span className='text-sm'>{request.user.name}</span>
                            <p className="text-xs text-muted-foreground">
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

                {(hasPermission('approve requests') && page_title == "Pending") && (
                    <div className="flex flex-col w-full">
                        <div className="flex items-center">
                            <div className="flex flex-col">
                                <span className='text-xs font-semibold text-muted-foreground'>Recommendation</span>
                                <span className={cn('font-black ', request.recommended_action === "Denied" && " text-destructive")}>
                                    {recommendedActionToPresentTense(request.recommended_action)}
                                </span>
                            </div>

                            <div className="flex justify-end gap-2 w-content ml-auto">
                                <Button onClick={() => handleAction("requests.approve")} variant="default">
                                    Approve
                                </Button>
                                <Button onClick={() => handleAction("requests.reject")} variant="outline" className='hover:border-destructive hover:text-destructive hover:bg-destructive/4'>
                                    Deny
                                </Button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline">More</Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuGroup>
                                            <DropdownMenuItem onClick={() => handleAction("requests.conditionally_approve")}>
                                                <CheckLine size={16} />
                                                <span>Conditionally Approve</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={toggleInput}>
                                                {isCommentInputOpen ? <MessageCircleOff size={16} /> : <MessageCirclePlus size={16} />}
                                                <span>{isCommentInputOpen ? "Cancel Comment" : "Add Comment"}</span>
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
        </div>
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
                <div className='flex flex-wrap gap-2 md:grid grid-cols-[1fr_1fr] w-auto'>
                    {request.request_facilities.map((rf) => {
                        const facility = request.facilities.find(f => f.id === rf.facility_id);
                        return (
                            <div className='flex flex-col items-center text-sm max-w-40 text-foreground mt-4' key={rf.date_requested + rf.time_start}>
                                <Link href={route("facility.detail", [rf.facility_id])} className='mr-auto ml-0 hover:underline'>
                                    <span className='font-semibold'>{facility?.name}</span>
                                </Link>
                                <div className="flex items-center flex-wrap text-foreground/70 font-medium">
                                    <div className="flex gap-1 items-center">
                                        <Calendar size={12} />
                                        <span className='text-sm'>{moment(rf.date_requested).format("MMM D, YYYY")}</span>
                                    </div>
                                    <div className="flex gap-1 items-center">
                                        <Clock size={12} />
                                        <span className='text-sm'>{formatTime(rf.time_start)} - {formatTime(rf.time_end)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ),
        },
        {
            value: "comment",
            icon: <MessageCircleWarning size={16} />,
            label: "Comment",
            content: request.comment ? (
                <p className='text-sm mt-4'>{request.comment}</p>
            ) : (
                <p className='text-muted-foreground text-sm w-full p-8 text-center'>No comment from admin</p>
            ),
        },
        ...(isPending ? [{
            value: "recommend",
            icon: <ThumbsUp size={16} />,
            label: "Recommendation",
            content: (
                <>
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
                                <span className='font-bold text-xs bg-muted-foreground text-background rounded-full w-4 h-4'>{tab.badge}</span>
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