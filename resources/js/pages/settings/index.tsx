import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { usePage } from '@inertiajs/react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function Settings() {
    const { auth } = usePage().props;
    const { hasRole } = usePermission();

    return (
        <DefaultLayout>
            <h1>Settings</h1>
            <Switch id='notifications' name='notifications'/>
            <Label htmlFor='notifications'>Notifications</Label>
        </DefaultLayout>
    );
}
