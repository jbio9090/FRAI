import DefaultLayout from '@/layout.tsx/default.';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { usePermission } from '@/hooks/use-permission';
import { Calendar, Clock } from 'lucide-react';

interface Facility {
    id: number;
    name: string;
    room_number: string;
    capacity: number;
    pivot: {
        date_requested: string;
        time_start: string;
        time_end: string;
    };
}

interface Equipment {
    id: number;
    name: string;
    facility_id: number;
    pivot: {
        quantity_needed: number;
    };
}

interface Request {
    id: number;
    title: string;
    description: string;
    status: string;
    user: {
        name: string;
        email: string;
    };
    created_at: string;
    facilities: Facility[];
    equipment: Equipment[];
}

interface DetailProps {
    children: React.ReactNode;
    request: Request;
}

export default function RequestDetail({ children, request }: DetailProps) {
    const { hasPermission, hasRole } = usePermission();
    let statusColor = "";

    function formatTime(time: string): string {
        return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }

    switch (request.status) {
        case 'approved':
            statusColor = "default";
            break;
        case 'pending':
            statusColor = "outline";
            break;
        case 'denied':
            statusColor = "destructive";
            break;
    }

    return (
        <DefaultLayout>
            <div className="flex flex-col w-full max-w-4xl gap-4 *:text-sm">
                <div className="flex flex-col gap-1">
                    <h1 className='font-bold text-xl'>{request.title}</h1>

                    <Badge variant={statusColor}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>

                    <p>{request.description}</p>
                    <p>Requested by: {request.user.name}</p>
                </div>

                <h2 className='font-semibold'>Facilities Requested</h2>

                <div className="flex flex-col gap-3">
                    {request.facilities.map((facility) => {
                        const facilityEquipment = request.equipment.filter(
                            (eq) => eq.facility_id === facility.id
                        );

                        const date = new Date(facility.pivot.date_requested).toLocaleDateString();

                        return (
                            <Card key={facility.id}>
                                <CardHeader>
                                    <CardTitle>{facility.name}</CardTitle>
                                    <CardDescription className='flex items-center text-sm gap-2'>
                                        <Calendar />
                                        <span>{date}</span>
                                        <Clock className='ml-4' />
                                        <span>
                                            {formatTime(facility.pivot.time_start)} to {formatTime(facility.pivot.time_end)}
                                        </span>
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
                                    {(facilityEquipment.length > 0) && (<span className="font-semibold text-muted-foreground">Equipment</span>)}
                                    <CardDescription>
                                        {facilityEquipment.map((eq) => (
                                            <div key={eq.id} className="flex justify-between">
                                                <span>{eq.name}</span>
                                                <span className="">x{eq.pivot.quantity_needed}</span>
                                            </div>
                                        ))}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </DefaultLayout>
    );
}