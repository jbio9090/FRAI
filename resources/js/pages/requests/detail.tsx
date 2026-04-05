import { Calendar, Clock, SendHorizontal } from 'lucide-react';
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
import AvatarWithInitials from '@/components/avatar-with-initials';
import { Pen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Field, FieldDescription } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import Comment from '@/components/comment';


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
            <div className="flex flex-col w-full gap-4 *:text-sm">
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

                <Tabs defaultValue="overview" className="mt-4 w-full">
                    <TabsList variant={"line"}>
                        <TabsTrigger value="overview">Overview</TabsTrigger>

                        <TabsTrigger value="facilities" className="flex items-center gap-2">
                            <span>Facilities</span>
                            <span className="flex items-center justify-center bg-secondary text-secondary-foreground h-5 min-w-[20px] px-1 rounded-full text-[10px] font-medium">
                                {request.facilities.length}
                            </span>
                        </TabsTrigger>

                        <TabsTrigger value="comments" className="flex items-center gap-2">
                            <span>Comments</span>
                            <span className="flex items-center justify-center bg-secondary text-secondary-foreground h-5 min-w-[20px] px-1 rounded-full text-[10px] font-medium">
                                {request.comments.length}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="flex flex-col gap-6 mt-6">
                        <div className="flex flex-col w-md max-w-full">
                            <p className='font-semibold mb-2 text-muted-foreground'>Description</p>
                            <p>{request.description ? request.description : "No Description Provided"}</p>
                        </div>

                        <div className="flex flex-wrap gap-12">
                            <div className="flex flex-col">
                                <p className='font-semibold mb-2 text-muted-foreground'>Requested by</p>
                                <div className="flex gap-2 items-center">
                                    <AvatarWithInitials avatarSrc={request.user.profile} username={request.user.profile} size='sm' />
                                    <p>{request.user.name}</p>
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <p className='font-semibold mb-2 text-muted-foreground'>Date Submitted</p>
                                <p>{moment(request.created_at).format("MMMM D, YYYY")}</p>
                            </div>
                        </div>
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

                                        {facilityRequest?.external_equipment && facilityRequest.external_equipment.length > 0 && (
                                            <CardContent>
                                                <Separator />
                                                <CardTitle className="font-semibold text-muted-foreground mt-4 mb-4">External Equipment</CardTitle>
                                                <CardDescription className='space-y-2 text-foreground'>
                                                    {facilityRequest.external_equipment.map((item, i) => (
                                                        <div key={i} className="text-sm">{item.name}</div>
                                                    ))}
                                                </CardDescription>
                                            </CardContent>
                                        )}

                                    </Card>
                                </div>
                            );
                        })}
                    </TabsContent>

                    <TabsContent value="comments" className="flex flex-col gap-6 mt-6 items-center w-full lg:grid lg:gap-1 grid-cols-[2fr_1fr]">
                        <div className="flex flex-col w-full max-w-2xl gap-3 justify-center">
                            {request.comments?.length > 0 ? (
                                request.comments.map((comment) => (
                                    <Comment
                                        key={comment.id}
                                        comment={comment}
                                    />
                                ))
                            ) : (
                                <p className="text-muted-foreground text-sm">No comments yet.</p>
                            )}
                        </div>

                        <div className="flex flex-col self-start w-full gap-6">
                            <Separator className="max-w-2xl lg:hidden" />
                            <CommentForm requestId={request.id} />
                        </div>

                    </TabsContent>
                </Tabs>
            </div>
        </DefaultLayout>
    );
}

function CommentForm({ requestId }: { requestId: number }) {
    const [body, setBody] = useState("");

    const submit = () => {
        router.post(route('requests.comment', requestId), { body }, {
            onSuccess: () => setBody(""),
            preserveScroll: true,
        });
    };

    return (
        <div className="flex flex-col gap-3 w-full max-w-2xl">
            <p className="font-semibold text-muted-foreground">Add a comment</p>
            <Textarea
                rows={3}
                className="w-full"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a comment..."
            />
            <Button
                size="sm"
                variant="secondary"
                className="self-start"
                disabled={body.trim().length === 0}
                onClick={submit}
            >
                <SendHorizontal size={16} />
                <span>Send</span>
            </Button>
        </div>
    );
}