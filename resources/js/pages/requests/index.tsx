import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { Button } from '@/components/ui/button';
import { router, Link } from '@inertiajs/react';
import { ArrowUpRight } from 'lucide-react';

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
}

interface PendingRequestsProps {
    requests: Request[];
    page_title: string;
}

export default function PendingRequests({ requests, page_title }: PendingRequestsProps) {
    const { hasPermission } = usePermission();

    return (
        <DefaultLayout>
            <div className="max-w-6xl w-full">
                <h1 className="text-2xl font-bold mb-6">{page_title} Requests</h1>

                <div className="space-y-4">
                    {requests.map((request) => (
                        <div key={request.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold">{request.title}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Requested by: {request.user.name}
                                    </p>
                                    <p className="mt-2 text-sm">{request.description}</p>
                                </div>


                                <div className="flex gap-2">
                                    <Link href={route("requests.detail", request.id)}>
                                        <Button
                                            size="xs"
                                            variant="outline"
                                        >
                                            <ArrowUpRight />
                                        </Button>
                                    </Link>


                                    {/* Only show approve/reject buttons to admins */}
                                    {(hasPermission('approve requests') && page_title == "Pending") && (
                                        <>
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
                                                variant="destructive"
                                            >
                                                Reject
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DefaultLayout>
    );
}