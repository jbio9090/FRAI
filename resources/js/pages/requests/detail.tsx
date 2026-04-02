import { Calendar, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DefaultLayout from '@/layout.tsx/default.';
import { Request } from '@/types/request';
import { Link, usePage } from '@inertiajs/react';
import { Separator } from '@/components/ui/separator';
import moment from 'moment';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Pen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DetailProps {
    children: React.ReactNode;
    request: Request;
}

export default function RequestDetail({ request }: DetailProps) {
    let statusColor = "";
    const auth = usePage().props.auth;

    const canEdit = request.status === 'Pending'
        && !request.on_hold
        && request.user.id === auth.user.id;

    function formatTime(time: string): string {
        return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }

    switch (request.status) {
        case 'Approved': statusColor = "default"; break;
        case 'Pending': statusColor = "outline"; break;
        case 'Denied': statusColor = "destructive"; break;
        case 'Conditionally Approved': statusColor = "secondary"; break;
    }

    const hasEquipment = request.equipment.length > 0;

    return (
        <DefaultLayout>
            <div className="flex flex-col w-full max-w-4xl gap-4 *:text-sm">
                {/* Header — always visible */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <h1 className='font-bold text-xl'>{request.title}</h1>
                        {canEdit && (
                            <Link href={route("requests.edit", request.id)}>
                                <Button variant={"ghost"} size={"icon-sm"}>
                                    <Pen />
                                </Button>
                            </Link>
                        )}
                    </div>
                    <Badge variant={statusColor}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                </div>

                <Tabs defaultValue="overview" className="mt-4">
                    <TabsList variant={"line"}>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="facilities">
                            <span>
                                Facilities
                            </span>
                            <span className="font-bold">
                                ({request.facilities.length})
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="flex flex-col gap-6 mt-6">
                        <div className="flex flex-col w-md max-w-full">
                            <p className='font-semibold mb-2 text-muted-foreground'>Description</p>
                            <p>{request.description}</p>
                        </div>

                        <div className="flex flex-wrap gap-12">
                            <div className="flex flex-col">
                                <p className='font-semibold mb-2 text-muted-foreground'>Requested by</p>
                                <p>{request.user.name}</p>
                            </div>
                            <div className="flex flex-col">
                                <p className='font-semibold mb-2 text-muted-foreground'>Date Submitted</p>
                                <p>{moment(request.created_at).format("MMMM D, YYYY")}</p>
                            </div>
                        </div>

                        {request.comment && (
                            <div className="flex flex-col w-full max-w-2xl">
                                <p className='font-semibold mb-2 text-muted-foreground'>Admin Comment</p>
                                <div className="flex gap-3 px-4 py-5 border border-border border-1 rounded-sm">
                                    <Avatar size="sm">
                                        <AvatarImage src='/profile/default.png' />
                                    </Avatar>
                                    <p>{request.comment}</p>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* Facilities Tab */}
                    <TabsContent value="facilities" className="flex flex-col gap-6 mt-6">
                        {request.facilities.map((facility) => {
                            const facilityRequest = request.request_facilities.find(
                                (rf) => rf.facility_id === facility.id &&
                                    facility.pivot.date_requested === rf.date_requested &&
                                    facility.pivot.time_start === rf.time_start &&
                                    facility.pivot.time_end === rf.time_end
                            );

                            const date = new Date(facility.pivot.date_requested).toLocaleDateString();

                            return (
                                <div
                                    key={`${facility.id}-${facility.pivot.date_requested}-${facility.pivot.time_start}`}
                                    className="flex flex-col gap-3"
                                >
                                    {/* Facility card */}
                                    <Card className='py-8 px-4'>
                                        <CardHeader>
                                            <Link href={route("facility.detail", [facility.id])}>
                                                <h2 className='font-bold hover:underline text-lg w-auto'>{facility.name}</h2>
                                            </Link>
                                            <CardDescription className='flex items-center flex-wrap text-sm gap-2 justify-between'>
                                                <div className="flex items-center gap-1">
                                                    <Calendar size={16} />
                                                    <span className='font-medium'>{date}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Clock size={16} />
                                                    <span className='font-medium'>
                                                        {formatTime(facility.pivot.time_start)} to {formatTime(facility.pivot.time_end)}
                                                    </span>
                                                </div>
                                            </CardDescription>
                                        </CardHeader>

                                        {hasEquipment && (
                                            <CardContent className='pt-2'>
                                                <CardTitle className='text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide'>
                                                    Equipment
                                                </CardTitle>
                                                <CardDescription className='flex flex-col gap-3'>
                                                    {request.equipment.map((eq) => (
                                                        <div key={eq.id} className="flex justify-between text-foreground">
                                                            <span>{eq.name}</span>
                                                            <span className='text-muted-foreground'>
                                                                Qty: {eq.pivot.quantity_needed}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </CardDescription>
                                            </CardContent>
                                        )}

                                        {facilityRequest?.external_equipment && (
                                            <CardContent>
                                                <Separator />
                                                <CardTitle className="font-semibold text-muted-foreground mt-4 mb-4">External Equipment</CardTitle>
                                                <CardDescription className='space-y-2 text-foreground'>
                                                    {facilityRequest.external_equipment}
                                                </CardDescription>
                                            </CardContent>
                                        )}

                                    </Card>
                                </div>
                            );
                        })}
                    </TabsContent>
                </Tabs>
            </div>
        </DefaultLayout>
    );
}