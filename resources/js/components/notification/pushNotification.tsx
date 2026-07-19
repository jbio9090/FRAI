import { router, usePage } from '@inertiajs/react';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function PushNotifications() {
    const { firebaseConfig } = usePage().props as any;
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isRegistered, setIsRegistered] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        checkSupport();
    }, []);

    const checkSupport = async () => {
        if (isNativePlatform()) {
            setIsSupported(true);
            await checkNativeRegistration();
        } else if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            await checkWebRegistration();
        }
    };

    const isNativePlatform = (): boolean => {
        return typeof (window as any).Capacitor !== 'undefined';
    };

    const checkNativeRegistration = async () => {
        try {
            const { PushNotifications } = await import('@capacitor/push-notifications');
            const permission = await PushNotifications.checkPermissions();
            setPermission(permission.receive as NotificationPermission);

            if (permission.receive === 'granted') {
                const token = await PushNotifications.getRegistration();
                setIsRegistered(!!token?.token);
            }
        } catch (err) {
            console.error('Error checking native registration:', err);
        }
    };

    const checkWebRegistration = async () => {
        try {
            const { getMessaging, getToken } = await import('firebase/messaging');
            const { initializeApp } = await import('firebase/app');

            const app = initializeApp(firebaseConfig);
            const messaging = getMessaging(app);
            const token = await getToken(messaging, {
                vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
            });

            if (token) {
                setIsRegistered(true);
            }
        } catch (err) {
            console.error('Error checking web registration:', err);
        }
    };

    const requestPermissionAndRegister = async () => {
        setLoading(true);
        setError(null);

        try {
            if (isNativePlatform()) {
                await registerNative();
            } else {
                await registerWeb();
            }
        } catch (err) {
            setError('Failed to enable push notifications');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const registerNative = async () => {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const { FCM } = await import('@capacitor-community/fcm');

        const permission = await PushNotifications.requestPermissions();
        setPermission(permission.receive as NotificationPermission);

        if (permission.receive !== 'granted') {
            setError('Notification permission denied');
            return;
        }

        await PushNotifications.register();

        PushNotifications.addListener('registration', async (token) => {
            try {
                const fcmToken = await FCM.getToken();
                await sendTokenToServer(fcmToken.token, getPlatform());
                setIsRegistered(true);
            } catch (err) {
                console.error('Error getting FCM token:', err);
                setError('Failed to register device');
            }
        });

        PushNotifications.addListener('registrationError', (err) => {
            console.error('Registration error:', err);
            setError('Failed to register for push notifications');
        });
    };

    const registerWeb = async () => {
        const result = await Notification.requestPermission();
        setPermission(result);

        if (result !== 'granted') {
            setError('Notification permission denied');
            return;
        }

        const { getMessaging, getToken } = await import('firebase/messaging');
        const { initializeApp } = await import('firebase/app');

        const app = initializeApp(firebaseConfig);
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });

        if (token) {
            await sendTokenToServer(token, 'web');
            setIsRegistered(true);
        }
    };

    const sendTokenToServer = async (token: string, platform: string) => {
        await router.post('/push/subscribe', {
            token,
            platform,
        }, {
            preserveState: true,
            preserveScroll: true,
            onError: (errors) => {
                setError('Failed to save device token');
                console.error(errors);
            },
        });
    };

    const unsubscribe = async () => {
        setLoading(true);
        setError(null);

        try {
            if (isNativePlatform()) {
                const { PushNotifications } = await import('@capacitor/push-notifications');
                const { FCM } = await import('@capacitor-community/fcm');

                const fcmToken = await FCM.getToken();
                await router.post('/push/unsubscribe', {
                    token: fcmToken.token,
                }, {
                    preserveState: true,
                    preserveScroll: true,
                });

                await PushNotifications.unregister();
            } else {
                const { getMessaging, getToken, deleteToken } = await import('firebase/messaging');
                const { initializeApp } = await import('firebase/app');

                const app = initializeApp(firebaseConfig);
                const messaging = getMessaging(app);
                const token = await getToken(messaging, {
                    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
                });

                if (token) {
                    await router.post('/push/unsubscribe', {
                        token,
                    }, {
                        preserveState: true,
                        preserveScroll: true,
                    });
                }

                await deleteToken(messaging);
            }

            setIsRegistered(false);
        } catch (err) {
            setError('Failed to unsubscribe');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getPlatform = (): string => {
        const { Capacitor } = require('@capacitor/core');
        return Capacitor.getPlatform();
    };

    if (!isSupported) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                    Push notifications are not supported on this device/browser.
                </p>
            </div>
        );
    }

    return (
        <div className="flex gap-12 justify-between items-center text-sm">
            <span className='text-sm font-semibold'>Notifications</span>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-red-800 text-sm">{error}</p>
                </div>
            )}

            {!isRegistered && (
                <Button
                    onClick={requestPermissionAndRegister}
                    disabled={loading}
                    size={"sm"}
                    variant={"outline"}
                >
                    <span className='text-sm'>
                        {loading ? 'Enabling...' : 'Enable Push Notifications'}
                    </span>
                </Button>
            )}

            {isRegistered && (
                <Button
                    onClick={unsubscribe}
                    disabled={loading}
                    size={"sm"}
                >
                    <span className='text-sm'>
                        {loading ? 'Disabling...' : 'Disable Push Notifications'}
                    </span>
                </Button>
            )}

            {permission === 'denied' && (
                <p className="text-sm text-gray-600 text-center">
                    Notifications are blocked. Please enable them in your device/browser settings.
                </p>
            )}
        </div>
    );
}
