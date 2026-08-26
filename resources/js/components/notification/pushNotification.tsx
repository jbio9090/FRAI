import { router, usePage } from '@inertiajs/react';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function PushNotifications() {
    const { firebaseConfig } = usePage().props as any;
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isRegistered, setIsRegistered] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(false);
    const [showIOSInstallModal, setShowIOSInstallModal] = useState(false);

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

    const getFirebaseApp = async () => {
        const { getApps, initializeApp } = await import('firebase/app');
        return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    };

    const checkWebRegistration = async () => {
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
                await sendTokenToServer(fcmToken.token, await getPlatform());
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

    const isIOS = (): boolean => {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    };

    const isSafari = (): boolean => {
        return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    };

    const isStandalone = (): boolean => {
        return window.matchMedia('(display-mode: standalone)').matches || 
               (window.navigator as any).standalone === true;
    };

    const showIOSInstallPrompt = (): boolean => {
        return isIOS() && isSafari() && !isStandalone();
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

    const getPlatform = async (): Promise<string> => {
        const { Capacitor } = await import('@capacitor/core');
        return Capacitor.getPlatform();
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

            {isSupported && isIOS() && isSafari() && !isStandalone() && (
                <button
                    type="button"
                    onClick={() => setShowIOSInstallModal(true)}
                    className="text-blue-600 underline text-sm font-medium"
                >
                    Install on iPhone
                </button>
            )}

            {isSupported && isIOS() && isSafari() && isStandalone() && isRegistered && (
                <p className="text-sm text-blue-600 text-center">
                    Open from Home Screen for push notifications to work. How to install? {" "}
                    <button
                        type="button"
                        onClick={() => setShowIOSInstallModal(true)}
                        className="underline hover:text-blue-800"
                    >
                        How to install
                    </button>
                </p>
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