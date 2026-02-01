import { useForm } from '@inertiajs/react';
import DefaultLayout from '@/layout.tsx/default.';
import { usePermission } from '@/hooks/use-permission';

interface DashboardProps {
    children: React.ReactNode;
}

export default function Dashboard({ children }: DashboardProps) {
    const { post } = useForm({})
    const { hasPermission, hasRole } = usePermission();

    function submit(e) {
        e.preventDefault();
        post(route('logout'));
    }

    return (
        <DefaultLayout>
            <h1>{hasRole("admin") ? "Hello Admin!": "Hello"}</h1>
        </DefaultLayout>
    );
}
