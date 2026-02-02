import { useForm } from '@inertiajs/react';
import DefaultLayout from '@/layout.tsx/default.';
import { usePermission } from '@/hooks/use-permission';

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

interface DashboardProps {
    children: React.ReactNode;
    request: Request;
}

export default function RequestDetail({ children, request }: DashboardProps) {
    const { post } = useForm({})
    const { hasPermission, hasRole } = usePermission();

    function submit(e) {
        e.preventDefault();
        post(route('logout'));
    }

    return (
        <DefaultLayout>
            <div className="flex flex-col w-ful *:text-sm">
                <h1 className='font-bold text-md'> {request.title}</h1>
                <div className="p-1 text-sm border border-1 border-border max-w-24 text-center rounded-full">
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </div>
                <h1>{request.description}</h1>

                <h1>Requested by: {request.user.name}</h1>
            </div>

        </DefaultLayout>
    );
}
