import { usePage } from '@inertiajs/react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getCsrfToken } from '@/components/chatbot/utils/csrfToken';
import { Button } from '@/components/ui/button';
import { isPushOptedOut, setPushOptedOut } from '@/lib/pushPreferences';

async function postPushJson(url: string, body: Record<string, unknown>): Promise<void> {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': getCsrfToken(),
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Push request failed with status ${response.status}`);
    }
}

async function fetchPushStatus(token: string): Promise<boolean | null> {
    try {
        const response = await fetch(route('notification.status'), {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': getCsrfToken(),
            },
            body: JSON.stringify({ token }),
        });

        if (!response.ok) {
            return null;
        }

        const data = (await response.json()) as { active?: boolean };

        return typeof data.active === 'boolean' ? data.active : null;
    } catch (err) {
        console.error('Error fetching push status:', err);

        return null;
    }
}

export default function PushNotifications() {
    const { firebaseConfig } = usePage().props as unknown as { firebaseConfig?: Record<string, unknown> };
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isRegistered, setIsRegistered] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(false);
    const checkGeneration = useRef(0);

    const isNativePlatform = useCallback((): boolean => {
        return typeof (window as Window & { Capacitor?: unknown }).Capacitor !== 'undefined';
    }, []);

    const getFirebaseApp = useCallback(async () => {
        const { getApps, initializeApp } = await import('firebase/app');
        return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    }, [firebaseConfig]);

    const checkNativeRegistration = useCallback(async (generation: number) => {
        try {
            if (isPushOptedOut()) {
                if (checkGeneration.current === generation) {
                    setIsRegistered(false);
                }
                return;
            }

            const { PushNotifications: CapPush } = await import('@capacitor/push-notifications');
            const perm = await CapPush.checkPermissions();
            setPermission(perm.receive as NotificationPermission);

            if (perm.receive === 'granted') {
                const reg = await CapPush.getRegistration();
                const token = reg?.token;
                if (!token) {
                    if (checkGeneration.current === generation) {
                        setIsRegistered(false);
                    }
                    return;
                }

                const active = await fetchPushStatus(token);
                if (checkGeneration.current === generation) {
                    // Fall back to token existence when the status lookup fails,
                    // so a transient backend error never hides the Disable button.
                    setIsRegistered(active ?? true);
                }
            } else if (checkGeneration.current === generation) {
                setIsRegistered(false);
            }
        } catch (err) {
            console.error('Error checking native registration:', err);
        }
    }, []);

    const checkWebRegistration = useCallback(
        async (generation: number) => {
            try {
                if (isPushOptedOut()) {
                    if (checkGeneration.current === generation) {
                        setIsRegistered(false);
                    }
                    return;
                }

                const { getMessaging, getToken } = await import('firebase/messaging');

                const app = await getFirebaseApp();
                const messaging = getMessaging(app);
                const registration =
                    (await navigator.serviceWorker.getRegistration()) ??
                    (await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }));
                const token = await getToken(messaging, {
                    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
                    serviceWorkerRegistration: registration,
                });

                if (!token) {
                    if (checkGeneration.current === generation) {
                        setIsRegistered(false);
                    }
                    return;
                }

                const active = await fetchPushStatus(token);
                if (checkGeneration.current === generation) {
                    setIsRegistered(active ?? true);
                }
            } catch (err) {
                console.error('Error checking web registration:', err);
            }
        },
        [getFirebaseApp],
    );

    const checkSupport = useCallback(async () => {
        const generation = ++checkGeneration.current;
        if (isNativePlatform()) {
            setIsSupported(true);
            await checkNativeRegistration(generation);
        } else if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            await checkWebRegistration(generation);
        }
    }, [isNativePlatform, checkNativeRegistration, checkWebRegistration]);

    useEffect(() => {
        void checkSupport();
    }, [checkSupport]);

    const sendTokenToServer = async (token: string, platform: string) => {
        try {
            await postPushJson(route('notification.subscribe'), {
                token,
                platform,
            });
            setPushOptedOut(false);
        } catch (err) {
            setError('Failed to save device token');
            console.error(err);
            throw err;
        }
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

        await new Promise<void>((resolve, reject) => {
            void CapPush.addListener('registration', async () => {
                try {
                    const fcmToken = await FCM.getToken();
                    await sendTokenToServer(fcmToken.token, await getPlatform());
                    checkGeneration.current += 1;
                    setIsRegistered(true);
                    resolve();
                } catch (err) {
                    console.error('Error getting FCM token:', err);
                    setError('Failed to register device');
                    reject(err instanceof Error ? err : new Error('Failed to register device'));
                }
            });

            void CapPush.addListener('registrationError', (err) => {
                console.error('Registration error:', err);
                setError('Failed to register for push notifications');
                reject(new Error('Failed to register for push notifications'));
            });
        });
    };

    const registerWeb = async () => {
        if (!('serviceWorker' in navigator)) {
            setError('Push notifications are not supported in this browser.');
            return;
        }

        const result = await Notification.requestPermission();
        setPermission(result);

        if (result !== 'granted') {
            setError('Notification permission denied');
            return;
        }

        const { getMessaging, getToken } = await import('firebase/messaging');

        const app = await getFirebaseApp();
        const messaging = getMessaging(app);
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: registration,
        });

        if (token) {
            await sendTokenToServer(token, 'web');
            checkGeneration.current += 1;
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
        // iPads in desktop mode report as "Macintosh", so also match touch-capable Macs.
        return (
            (/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        );
    };

    const isSafari = (): boolean => {
        return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    };

    const isStandalone = (): boolean => {
        return (
            window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
        );
    };

    const showIOSInstallPrompt = (): boolean => {
        return isIOS() && isSafari() && !isStandalone();
    };

    const unsubscribe = async () => {
        setLoading(true);
        setError(null);
        // Invalidate any in-flight mount-time check so it cannot flip us back on.
        checkGeneration.current += 1;
        const generation = checkGeneration.current;

        try {
            if (isNativePlatform()) {
                const { PushNotifications: CapPush } = await import('@capacitor/push-notifications');
                const { FCM } = await import('@capacitor-community/fcm');

                const fcmToken = await FCM.getToken();
                await postPushJson(route('notification.unsubscribe'), {
                    token: fcmToken.token,
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
                    await postPushJson(route('notification.unsubscribe'), {
                        token,
                    });
                }

                await deleteToken(messaging);
            }

            // Persist the opt-out before flipping UI, and only after the server acked.
            setPushOptedOut(true);
            if (checkGeneration.current === generation) {
                setIsRegistered(false);
            }
        } catch (err) {
            setError('Failed to unsubscribe');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!isSupported) {
        return (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-yellow-800">Push notifications are not supported on this device/browser.</p>
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between gap-12 text-sm">
                <span className="text-sm font-semibold">Notifications</span>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {isSupported && !isIOS() && isRegistered && (
                    <p className="text-center text-sm text-green-600">Push notifications are active on this device.</p>
                )}

                {!isRegistered && !showIOSInstallPrompt() && (
                    <Button onClick={requestPermissionAndRegister} disabled={loading} size={'sm'} variant={'outline'}>
                        <span className="text-sm">{loading ? 'Enabling...' : 'Enable Push Notifications'}</span>
                    </Button>
                )}

                {isRegistered && (
                    <Button onClick={unsubscribe} disabled={loading} size={'sm'}>
                        <span className="text-sm">{loading ? 'Disabling...' : 'Disable Push Notifications'}</span>
                    </Button>
                )}

                {permission === 'denied' && (
                    <p className="text-center text-sm text-gray-600">
                        Notifications are blocked. Please enable them in your device/browser settings.
                    </p>
                )}
            </div>

            {showIOSInstallPrompt() && !isRegistered && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-900">Enable push on your iPhone</p>
                    <p className="mt-1 text-sm text-blue-800">
                        Apple only allows web push for apps added to the Home Screen (iOS 16.4 or later). Safari tabs can&apos;t receive
                        notifications.
                    </p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-blue-800">
                        <li>Tap the Share button in Safari&apos;s toolbar.</li>
                        <li>Choose &quot;Add to Home Screen&quot;, then tap Add.</li>
                        <li>Open the app from the new Home Screen icon.</li>
                        <li>Come back here and tap Enable Push Notifications.</li>
                    </ol>
                </div>
            )}
        </>
    );
}
