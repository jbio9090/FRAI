import PushNotifications from '@/components/notification/pushNotification';
import { usePermission } from '@/hooks/use-permission';
import DefaultLayout from '@/layout.tsx/default.';
import { usePage } from '@inertiajs/react';

export default function Settings() {

    return (
        <DefaultLayout>
            <h1>Settings</h1>
            <PushNotifications />
        </DefaultLayout>
    );
}
