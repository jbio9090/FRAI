import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { usePage } from '@inertiajs/react';

// interface DashboardProps {
//     children: React.ReactNode;
// }

export default function Dashboard() {
    const { auth } = usePage().props;
    const { hasRole } = usePermission();

    return (
        <DefaultLayout>
            <h1>{hasRole("admin") ? `Hello ${auth.user.name}!` : `Hello, ${auth.user.name}`}</h1>
        </DefaultLayout>
    );
}
