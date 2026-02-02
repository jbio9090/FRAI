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

export default function Dashboard({ children, request }: DashboardProps) {
    const { post } = useForm({})
    const { hasPermission, hasRole } = usePermission();

    console.log(request);

    function submit(e) {
        e.preventDefault();
        post(route('logout'));
    }

    return (
        <DefaultLayout>
            <h1>{request.id}</h1>
            <h1>{request.description}</h1>

            <h1>Requested by: {request.user.name}</h1>
        </DefaultLayout>
    );
}
