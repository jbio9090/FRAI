import { router, Link } from '@inertiajs/react';
import { ArrowUpRight, Calendar, ChevronDown, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import moment from 'moment';
import { useState } from 'react';
import MotionChevron from '@/components/animated_icons/MotionChevron';

interface Request {
    id: number;
    title: string;
    description: string;
    status: string;
    user: {
        name: string;
        email: string;
    };
    request_facilities: RequestFacility[];
    facilities: Facility[];
    created_at: string;
    updated_at: string;
}

interface RequestFacility {
    facility_id: number;
    id: number,
    time_end: string,
    time_start: string,
    date_requested: string;
}

interface Facility {
    id: number;
    name: string;
    building: string;
    capacity: number
}

interface RequestsPageProps {
    requests: Request[];
    page_title: string;
}

export default function PendingRequests({ requests, page_title }: RequestsPageProps) {
    const { hasPermission } = usePermission();
    console.log(requests);


    return (
        <DefaultLayout>
            <div className="max-w-6xl mx-auto w-full">
                <h1 className="text-2xl font-bold mb-6">{page_title} Requests</h1>

                <div className="gap-4 flex flex-col lg:grid grid-cols-[1fr_1fr]">
                    {requests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start flex-col gap-6">
                                <div className="flex justify-around w-full">
                                    <div className='flex flex-col gap-1'>
                                        <h3 className="font-bold">{request.title}</h3>
                                        <p className="text-sm">{request.description}</p>
                                        <p className="text-sm">
                                            from {request.user.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Submitted {moment(request.updated_at).fromNow()}
                                        </p>

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

                                <RequestedFaciltiiesCollapsible
                                    request={request}
                                />


                                {/* Only show approve/reject buttons to admins */}
                                {(hasPermission('approve requests') && page_title == "Pending") && (
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

function RequestedFaciltiiesCollapsible({ request }: CollapsibleProps) {
    const [openCollapsible, setCollapsibleState] = useState(false);

    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'pm' : 'am';
        const hour12 = h % 12 || 12;
        return `${hour12}:${minutes}${ampm}`;
    };

    return (
        <Collapsible className='w-full' open={openCollapsible} onOpenChange={setCollapsibleState}>
            <CollapsibleTrigger className='text-sm text-muted-foreground cursor-pointer flex items-center gap-1 hover:text-foreground w-full'>
                <Calendar size={16} />
                <span>Facilities Requested</span>
                <span className='text-xs font-bold bg-muted-foreground text-background rounded-full w-4 h-4 ml-1'>{request.facilities.length}</span>
                <MotionChevron openCollapsible={openCollapsible} className='mr-0 ml-auto' />
            </CollapsibleTrigger>
            <CollapsibleContent className='flex flex-col gap-2 md:grid grid-cols-[1fr_1fr]'>
                {request.request_facilities.map((rf) => {
                    const facility = request.facilities.find(f => f.id === rf.facility_id);
                    console.log(rf.date_requested)
                    return (
                        <div className='flex flex-col items-center text-sm text-foreground mt-1' key={rf.date_requested + rf.time_start}>
                            <span className='font-semibold'>{facility?.name}</span>
                            <div className="flex gap-2 items-center text-muted-foreground font-medium">
                                <div className="flex gap-1 items-center">
                                    <Calendar size={12} />
                                    <span className='text-xs'>
                                        {moment(rf.date_requested).format("MMM D, YYYY")}
                                    </span>
                                </div>
                                <div className="flex gap-1 items-center">
                                    <Clock size={12} />
                                    <span className='text-xs'>
                                        {formatTime(rf.time_start)} - {formatTime(rf.time_end)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </CollapsibleContent>
        </Collapsible>
    );
}