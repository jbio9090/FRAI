import { useForm } from '@inertiajs/react';
import DefaultLayout from '@/layout.tsx/default.';
import { usePermission } from '@/hooks/use-permission';

interface Rule {
    rule: string;
    created_at: string;
}

interface DashboardProps {
    children: React.ReactNode;
    rules: Rule[];
}

export default function Rules({ children, rules }: DashboardProps) {
    const { post } = useForm({})
    const { hasPermission, hasRole } = usePermission();

    function submit(e) {
        e.preventDefault();
        post(route('logout'));
    }

    return (
        <DefaultLayout>
            <div className="flex flex-col w-ful *:text-sm">
                {rules.map((rule) => (
                    <h1>{rule.rule}</h1>
                ))}
            </div>

        </DefaultLayout>
    );
}
