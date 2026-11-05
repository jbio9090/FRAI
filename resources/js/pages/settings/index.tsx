import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePermission } from '@/hooks/use-permission';
import GeneralTab from './general-tab';
import RequestTab from './request-tab';

interface PageProps extends Record<string, unknown> {
    auth: {
        user: {
            id: number;
            name: string;
            profile: string;
            roles: string[];
            email: string;
            position?: string;
            admin_email_notifications_enabled: boolean;
            email_notifications_enabled: boolean;
        };
    };
    requestOptions: import('@/types/request').RequestOptions;
}

export default function Settings() {
    const { auth, requestOptions } = usePage<PageProps>().props;
    const { hasPermission } = usePermission();
    const canManageRequestOptions = hasPermission('manage request options');
    const [activeTab, setActiveTab] = useState<string>('general');

    return (
        <div className="flex flex-col mx-auto max-w-2xl gap-6 w-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList variant="line" className="w-full h-auto min-h-9 border-b">
                    <TabsTrigger value="general">General</TabsTrigger>
                    {canManageRequestOptions && <TabsTrigger value="request">Request</TabsTrigger>}
                </TabsList>

                <TabsContent value="general">
                    <GeneralTab auth={auth} />
                </TabsContent>

                {canManageRequestOptions && (
                    <TabsContent value="request">
                        <RequestTab requestOptions={requestOptions} />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
