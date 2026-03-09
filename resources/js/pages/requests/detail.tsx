import { Calendar, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import DefaultLayout from '@/layout.tsx/default.';
import { Request } from '@/types/request';
import { Equipment } from '@/types/equipment';
import { Link } from '@inertiajs/react';
import { Separator } from '@/components/ui/separator';
import moment from 'moment';

interface DetailProps {
    children: React.ReactNode;
    request: Request;
}

export default function RequestDetail({ request }: DetailProps) {
    let statusColor = "";

    function formatTime(time: string): string {
        return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }

    switch (request.status) {
        case 'Approved':
            statusColor = "default";
            break;
        case 'Pending':
            statusColor = "outline";
            break;
        case 'Denied':
            statusColor = "destructive";
            break;
        case 'Conditionally Approved':
            statusColor = "secondary";
            break;
    }

    return (
        <DefaultLayout>
            <div className="flex flex-col w-full max-w-4xl gap-4 *:text-sm">
                <div className="flex flex-col gap-7 text-sm">
                    <div className="flex flex-col gap-3">
                        <h1 className='font-bold text-xl'>{request.title}</h1>
                        <Badge variant={statusColor}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                    </div>

                    <div className="flex flex-col w-md max-w-full">
                        <p className='font-semibold mb-2 text-muted-foreground '>Description</p>
                        <p >{request.description}</p>
                    </div>

                    <div className="flex flex-wrap gap-12">
                        <div className="flex flex-col">
                            <p className='font-semibold mb-2 text-muted-foreground '>Requested by</p>
                            <p>{request.user.name}</p>
                        </div>

                        <div className="flex flex-col">
                            <p className='font-semibold mb-2 text-muted-foreground '>Date Submitted</p>
                            <p>{moment(request.created_at).format("MMMM D, YYYY")}</p>
                        </div>
                    </div>

                    {request.comment && (
                        <div className="flex flex-col w-md max-w-full">
                            <p className='font-semibold mb-2 text-muted-foreground '>Admin Comment</p>
                            <p >{request.comment}</p>
                        </div>
                    )}
                </div>


                <h2 className='font-semibold text-muted-foreground mt-9 mb-4'>Facilities Requested</h2>
                <div className="flex flex-col gap-8 lg:grid grid-cols-[1fr_1fr] w-full">
                    {request.facilities.map((facility) => {
                        const facilityEquipment = request.equipment.filter(
                            (eq) => eq.facility_id === facility.id
                        );
                        const facilityRequest = request.request_facilities.find(
                            (rf) => rf.facility_id === facility.id &&
                                facility.pivot.date_requested === rf.date_requested &&
                                facility.pivot.time_start === rf.time_start &&
                                facility.pivot.time_end === rf.time_end
                        )

                        const date = new Date(facility.pivot.date_requested).toLocaleDateString();

                        return (
                            <Card key={facility.id} className='py-8 px-4'>
                                <CardHeader>
                                    <Link href={route("facility.detail", [facility.id])}>
                                        <CardTitle className='hover:underline text-lg'>{facility.name}</CardTitle>
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

                                {(facilityEquipment.length > 0) && (
                                    <CardContent>
                                        <CardTitle className="font-semibold text-muted-foreground mb-4">Equipments</CardTitle>
                                        <CardDescription className='flex flex-col gap-4'>
                                            {facilityEquipment.map((eq) => (
                                                <div key={eq.id} className="flex justify-between text-foreground">
                                                    <span>{eq.name}</span>
                                                    <span className="">{eq.pivot.quantity_needed}</span>
                                                </div>
                                            ))}
                                        </CardDescription>
                                    </CardContent>
                                )}

                                {facilityRequest?.external_equipment && (
                                    <CardContent>
                                        <Separator />
                                        <CardTitle className="font-semibold text-muted-foreground mt-4 mb-4">External Equipments</CardTitle>
                                        <CardDescription className='space-y-2 text-foreground'>
                                            {facilityRequest.external_equipment}
                                        </CardDescription>
                                    </CardContent>
                                )}

                            </Card>
                        );
                    })}
                </div>
            </div>
        </DefaultLayout>
    );
}