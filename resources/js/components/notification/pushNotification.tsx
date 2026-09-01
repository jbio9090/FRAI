import { router, usePage } from '@inertiajs/react';
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

export default function PushNotifications() {
    const { firebaseConfig } = usePage().props as unknown as { firebaseConfig?: Record<string, unknown> };
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isRegistered, setIsRegistered] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(false);

    const isNativePlatform = useCallback((): boolean => {
        return typeof (window as Window & { Capacitor?: unknown }).Capacitor !== 'undefined';
    }, []);

    const getFirebaseApp = useCallback(async () => {
        const { getApps, initializeApp } = await import('firebase/app');
        return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    }, [firebaseConfig]);

    const checkNativeRegistration = useCallback(async () => {
        try {
            const { PushNotifications: CapPush } = await import('@capacitor/push-notifications');
            const perm = await CapPush.checkPermissions();
            setPermission(perm.receive as NotificationPermission);

            if (perm.receive === 'granted') {
                const token = await CapPush.getRegistration();
                setIsRegistered(!!token?.token);
            }
        } catch (err) {
            console.error('Error checking native registration:', err);
        }
    }, []);

    const checkWebRegistration = useCallback(async () => {
        try {
            const { getMessaging, getToken } = await import('firebase/messaging');

            const app = await getFirebaseApp();
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
    }, [getFirebaseApp]);

    const checkSupport = useCallback(async () => {
        if (isNativePlatform()) {
            setIsSupported(true);
            await checkNativeRegistration();
        } else if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            await checkWebRegistration();
        }
    }, [isNativePlatform, checkNativeRegistration, checkWebRegistration]);

    useEffect(() => {
        void checkSupport();
    }, [checkSupport]);

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

    const getPlatform = async (): Promise<string> => {
        const { Capacitor } = await import('@capacitor/core');
        return Capacitor.getPlatform();
    };

    const registerNative = async () => {
        const { PushNotifications: CapPush } = await import('@capacitor/push-notifications');
        const { FCM } = await import('@capacitor-community/fcm');

        const perm = await CapPush.requestPermissions();
        setPermission(perm.receive as NotificationPermission);

        if (perm.receive !== 'granted') {
            setError('Notification permission denied');
            return;
        }

        await CapPush.register();

        CapPush.addListener('registration', async () => {
            try {
                const fcmToken = await FCM.getToken();
                await sendTokenToServer(fcmToken.token, await getPlatform());
                setIsRegistered(true);
            } catch (err) {
                console.error('Error getting FCM token:', err);
                setError('Failed to register device');
            }
        });

        CapPush.addListener('registrationError', (err) => {
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

        const app = await getFirebaseApp();
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });

        if (token) {
            await sendTokenToServer(token, 'web');
            setIsRegistered(true);
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

    const isIOS = (): boolean => {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
    };

    const isSafari = (): boolean => {
        return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    };

    const isStandalone = (): boolean => {
        return window.matchMedia('(display-mode: standalone)').matches || 
               (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    };

    const showIOSInstallPrompt = (): boolean => {
        return isIOS() && isSafari() && !isStandalone();
    };

    const unsubscribe = async () => {
        setLoading(true);
        setError(null);

        try {
            if (isNativePlatform()) {
                const { PushNotifications: CapPush } = await import('@capacitor/push-notifications');
                const { FCM } = await import('@capacitor-community/fcm');

                const fcmToken = await FCM.getToken();
                await router.post('/push/unsubscribe', {
                    token: fcmToken.token,
                }, {
                    preserveState: true,
                    preserveScroll: true,
                });

                await CapPush.unregister();
            } else {
                const { getMessaging, getToken, deleteToken } = await import('firebase/messaging');

                const app = await getFirebaseApp();
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

            {isSupported && !isIOS() && isRegistered && (
                <p className="text-sm text-green-600 text-center">
                    Push notifications are active on this device.
                </p>
            )}

            {!isRegistered && !showIOSInstallPrompt() && (
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
