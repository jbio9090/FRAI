import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';

// interface DashboardProps {
//     children: React.ReactNode;
// }

export default function Dashboard() {
    const { hasRole } = usePermission();

    return (
        <DefaultLayout>
            <h1>{hasRole("admin") ? "Hello Admin!" : "Hello"}</h1>
        </DefaultLayout>
    );
}
