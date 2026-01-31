import { useForm } from '@inertiajs/react';
import DefaultLayout from '@/layout.tsx/default.';

interface DashboardProps {
    children: React.ReactNode;
}

export default function Dashboard({ children }: DashboardProps) {
    const { post } = useForm({});

    function submit(e) {
        e.preventDefault();
        post(route('logout'));
    }

    return (
        <DefaultLayout>
            <h1>HEllo</h1>
        </DefaultLayout>
    );
}
