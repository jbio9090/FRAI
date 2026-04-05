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
    console.log(request);


    return (
        <DefaultLayout>
            <div className="flex flex-col w-full gap-4 *:text-sm">
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
                    <TabsContent value="facilities" className="flex flex-col gap-4 mt-6">
                        {request.request_facilities.map((rf) => {
                            const facility = request.facilities.find(f => f.id === rf.facility_id);
                            if (!facility) return null;

                            const facilityEquipment = request.equipment.filter(eq =>
                                eq.facilities?.some(f => f.id === rf.facility_id)
                            );

                            const date = new Date(rf.date_requested).toLocaleDateString('en-US', {
                                month: 'long', day: 'numeric', year: 'numeric'
                            });

                            return (
                                <div
                                    key={`${rf.facility_id}-${rf.date_requested}-${rf.time_start}`}
                                    className="rounded-xl border border-border bg-card overflow-hidden"
                                >
                                    {/* Header */}
                                    <div className="px-5 py-4 border-b border-border">
                                        <Link href={route("facility.detail", [facility.id])}>
                                            <h2 className="text-[15px] font-medium hover:underline mb-2">
                                                {facility.name}
                                            </h2>
                                        </Link>
                                        <div className="flex flex-wrap gap-3">
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted border border-border rounded-full px-2.5 py-1">
                                                <Calendar size={12} />
                                                {date}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted border border-border rounded-full px-2.5 py-1">
                                                <Clock size={12} />
                                                {formatTime(rf.time_start)} – {formatTime(rf.time_end)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Equipment */}
                                    {facilityEquipment.length > 0 && (
                                        <div className="px-5 py-4">
                                            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
                                                Equipment
                                            </p>
                                            <div className="flex flex-col divide-y divide-border">
                                                {facilityEquipment.map((eq) => (
                                                    <div key={eq.id} className="flex justify-between items-center py-2 text-sm">
                                                        <span>{eq.name}</span>
                                                        <span className="text-xs text-muted-foreground bg-muted rounded px-2 py-0.5">
                                                            Qty: {eq.pivot.quantity_needed}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* External Equipment */}
                                    {rf.external_equipments?.length > 0 && (
                                        <div className="px-5 py-4 border-t border-border">
                                            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
                                                External equipment
                                            </p>
                                            <div className="flex flex-col divide-y divide-border">
                                                {rf.external_equipments.map((item, i) => (
                                                    <div key={i} className="text-sm py-2">{item.name}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </TabsContent>
                    
                    <TabsContent
                        value="comments"
                        className="mt-6 w-full relative flex flex-col items-start md:grid md:grid-cols-[3fr_4fr] gap-4"
                    >
                        <div className="order-1 md:order-2 w-full max-w-2xl h-full overflow-y-auto pr-2 pb-32 md:pb-0">
                            <div className="flex flex-col gap-3">
                                {request.comments?.length > 0 ? (
                                    request.comments.map((comment) => (
                                        <Comment key={comment.id} comment={comment} />
                                    ))
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        No comments yet.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div
                            className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t p-4 md:sticky md:top-4 md:z-auto md:p-0 md:border-0"
                        >
                            <div className="max-w-2xl mx-auto flex flex-col gap-3">
                                <CommentForm requestId={request.id} />
                            </div>
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