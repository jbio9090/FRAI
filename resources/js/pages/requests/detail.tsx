import { Calendar, Clock, PauseCircle, ShieldAlert, School } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import DefaultLayout from '@/layout.tsx/default.';

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
    on_hold: boolean;
    priority_level: number;
    priority_reason: string | null;
    held_by_request: { id: number; title: string } | null;
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

export default function RequestDetail({ request }: DetailProps) {
    type BadgeVariant = 'default' | 'outline' | 'destructive' | 'secondary' | null | undefined;
    let statusColor: BadgeVariant = 'outline';

    function formatTime(time: string): string {
        return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }

    switch (request.status) {
        case 'approved':
            statusColor = 'default';
            break;
        case 'pending':
            statusColor = 'outline';
            break;
        case 'denied':
            statusColor = 'destructive';
            break;
    }

    return (
        <DefaultLayout>
            <div className="flex flex-col w-full max-w-4xl gap-4 *:text-sm">
                <div className="flex flex-col gap-2">
                    <h1 className='font-bold text-xl'>{request.title}</h1>

                    <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant={statusColor}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>

                        {request.on_hold && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-500 bg-yellow-50 flex items-center gap-1">
                                <PauseCircle size={12} />
                                On Hold
                            </Badge>
                        )}
                        {request.priority_level === 2 && (
                            <Badge variant="outline" className="text-red-600 border-red-500 bg-red-50 flex items-center gap-1">
                                <ShieldAlert size={12} />
                                Gov / High Authority
                            </Badge>
                        )}
                        {request.priority_level === 1 && (
                            <Badge variant="outline" className="text-blue-600 border-blue-500 bg-blue-50 flex items-center gap-1">
                                <School size={12} />
                                School Event
                            </Badge>
                        )}
                    </div>

                    {request.on_hold && request.held_by_request && (
                        <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                            ⏸ This request is on hold because of higher-priority request:{' '}
                            <span className="font-semibold">"{request.held_by_request.title}"</span>
                            {request.priority_reason && (
                                <span className="block mt-1 text-yellow-600">Reason: {request.priority_reason}</span>
                            )}
                        </div>
                    )}

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
                                        <Calendar size={16}/>
                                        <span className='font-medium'>{date}</span>
                                        <Clock className='ml-4' size={16}/>
                                        <span className='font-medium'>
                                            {formatTime(facility.pivot.time_start)} to {formatTime(facility.pivot.time_end)}
                                        </span>
                                    </CardDescription>
                                </CardHeader>

                                <CardContent>
                                    {(facilityEquipment.length > 0) && (<span className="font-semibold text-muted-foreground">Equipments</span>)}
                                    <CardDescription className='space-y-2'>
                                        {facilityEquipment.map((eq) => (
                                            <div key={eq.id} className="flex justify-between text-foreground">
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
