import { router, Link } from '@inertiajs/react';
import { ArrowUpRight, Calendar, Clock, MessageCircleWarning, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger, } from "@/components/ui/tabs"
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import moment from 'moment';
import { Request, RequestsPageProps } from '@/types/request';
import { formatTime } from '@/lib/utils';

export default function PendingRequests({ requests, page_title }: RequestsPageProps) {
    const { hasPermission } = usePermission();

    return (
        <DefaultLayout>
            <div className="max-w-6xl mx-auto w-full">
                <h1 className="text-2xl font-bold mb-6">{page_title} Requests</h1>

                <div className="gap-4 flex flex-col lg:grid grid-cols-[1fr_1fr]">
                    {requests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-8 h-content min-h-0">
                            <div className="flex justify-between items-start flex-col gap-6">
                                <div className="flex justify-around w-full">
                                    <div className='flex flex-col gap-1'>
                                        <h3 className="font-bold">{request.title}</h3>
                                        <p className="mt-2 text-foreground/70 text-sm">{request.description}</p>

                                        <div className="text-sm mt-4 flex gap-2 items-center">
                                            <Avatar size='sm'>
                                                <AvatarImage
                                                    src='/profile/default.png'
                                                />
                                            </Avatar>
                                            <span className='text-sm'>
                                                {request.user.name}
                                            </span>
                                            <p className="text-xs text-muted-foreground">
                                                Submitted {moment(request.updated_at).fromNow()}
                                            </p>
                                        </div>
                                    </div>

                                    <Link href={route("requests.detail", request.id)} className='flex-0 ml-auto mr-0'>
                                        <Button
                                            size="xs"
                                            variant="outline"
                                        >
                                            <ArrowUpRight />
                                        </Button>
                                    </Link>
                                </div>

                                <RequestDetails
                                    request={request}
                                />

                                {(hasPermission('approve requests') && page_title == "Pending") && (
                                    <div className="flex items-center w-full">
                                        <div className="flex flex-col">
                                            <span className='text-xs font-semibold text-muted-foreground'>Recommendation</span>
                                            <span className='font-bold'>{request.recommended_action}</span>
                                        </div>

                                        <div className="flex justify-end gap-2 w-content ml-auto">
                                            <Button
                                                onClick={() => {
                                                    router.post(route('requests.approve', request.id));
                                                }}
                                                variant="default"
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    router.post(route('requests.reject', request.id));
                                                }}
                                                variant="outline"
                                                className='hover:border-destructive hover:text-destructive hover:bg-destructive/4'
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    </div>

                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DefaultLayout>
    );
}

interface CollapsibleProps {
    request: Request;
}

function RequestDetails({ request }: CollapsibleProps) {
    const isPending: boolean = (request.status === "Pending") ? true : false;

    console.log(request);
    

    return (
        <Tabs defaultValue="facilities" className='w-full'>
            <TabsList className="w-full" variant={"line"}>
                <TabsTrigger value="facilities">
                    <Calendar size={16} />
                    <span>Facilities</span>
                    <span className='font-bold text-xs bg-muted-foreground text-background rounded-full w-4 h-4 ml-1'>{request.facilities.length}</span>
                </TabsTrigger>
                <TabsTrigger value='comment'>
                    <MessageCircleWarning size={16} />
                    <span>Comment</span>
                </TabsTrigger>
                {isPending && (
                    <TabsTrigger value='recommend'>
                        <ThumbsUp size={16} />
                        <span>Recommendation</span>
                    </TabsTrigger>
                )}
            </TabsList>
            <TabsContent value="facilities" className='flex flex-wrap gap-2 md:grid grid-cols-[1fr_1fr] w-auto'>
                {request.request_facilities.map((rf) => {
                    const facility = request.facilities.find(f => f.id === rf.facility_id);

                    return (
                        <div className='flex flex-col items-center text-sm max-w-40 text-foreground mt-4' key={rf.date_requested + rf.time_start}>
                            <Link href={route("facility.detail", [rf.facility_id])} className='mr-auto ml-0 hover:underline'>
                                <span className='font-semibold'>
                                    {facility?.name}
                                </span>
                            </Link>
                            <div className="flex items-center flex-wrap text-foreground/70 font-medium">
                                <div className="flex gap-1 items-center">
                                    <Calendar size={12} />
                                    <span className='text-sm'>
                                        {moment(rf.date_requested).format("MMM D, YYYY")}
                                    </span>
                                </div>
                                <div className="flex gap-1 items-center">
                                    <Clock size={12} />
                                    <span className='text-sm'>
                                        {formatTime(rf.time_start)} - {formatTime(rf.time_end)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </TabsContent>
            <TabsContent value='comment'>
                {(request.comment) ? (
                    <p className='text-sm'>
                        {request.comment}
                    </p>
                ) : (
                    <p className='text-muted-foreground text-sm w-full p-8 text-center'>
                        No comment from admin
                    </p>
                )}

            </TabsContent>
            {(isPending) && (<TabsContent value='recommend'>
                <p className='font-bold mt-4'>{request.recommended_action}</p>
                <p className='text-sm'>
                    {request.recommended_action_reason}
                </p>
            </TabsContent>)}

        </Tabs>
    );
}
