import { router, usePage } from '@inertiajs/react';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, deleteToken } from 'firebase/messaging';

const getFcmMessaging = () => {
    const config = (window as any).fcmConfig;

    if (!config || !config.projectId) {
        console.error("FCM Config is missing. Check Render Env Vars and app.blade.php");
        return null;
    }

    const app = initializeApp(config);
    return getMessaging(app);
};

export default function PushNotifications() {
    const { vapidPublicKey } = usePage().props as any;
    const [permission, setPermission] = useState(Notification.permission);
    const [isSubscribed, setIsSubscribed] = useState(false); // Changed to boolean for FCM
    const [isSupported, setIsSupported] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);

            if (Notification.permission === 'granted') {
                checkExistingSubscription();
            }
        }
    }, []);

  
    const checkExistingSubscription = async () => {
        const messaging = getFcmMessaging();
        if (!messaging) return;

        try {
            const registration = await getOrRegisterServiceWorker();
            const validVapidPublicKey = vapidPublicKey ?? (window as any).fcmConfig?.vapidPublicKey;

            const token = await getToken(messaging, {
                vapidKey: validVapidPublicKey,
                serviceWorkerRegistration: registration,
            });

            if (token) {
                setIsSubscribed(true); 
            } else {
                setIsSubscribed(false); 
            }
        } catch (e) {
            console.log("No existing token found or error checking.", e);
            setIsSubscribed(false);
        }
    };

    const getOrRegisterServiceWorker = async () => {
        if (!('serviceWorker' in navigator)) return null;
        try {
            let registration = await navigator.serviceWorker.getRegistration('/serviceWorker.js');
            if (!registration) {
                registration = await navigator.serviceWorker.register('/serviceWorker.js', { scope: '/' });
            }
            return registration;
        } catch (err) {
            console.error('Service worker registration failed:', err);
            return null;
        }
    };

    const requestPermission = async () => {
        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            if (result === 'granted') {
                await subscribeToPush();
            }
        } catch (err) {
            setError('Failed to request permission');
        }
    };

    const subscribeToPush = async () => {
        const messaging = getFcmMessaging();
        if (!messaging) return;

        setLoading(true);
        setError(null);

        try {
            const registration = await getOrRegisterServiceWorker();
            if (!registration) {
                setError('Service worker not available');
                return;
            }

            const validVapidPublicKey = vapidPublicKey ?? import.meta.env.VITE_VAPID_PUBLIC_KEY;

            // 2. Use Firebase getToken instead of native pushManager
            // We pass the explicit serviceWorkerRegistration because your file isn't named firebase-messaging-sw.js
            const currentToken = await getToken(messaging, {
                vapidKey: validVapidPublicKey,
                serviceWorkerRegistration: registration,
            });

            if (currentToken) {
                // 3. Send the simple string token to Laravel (Matches NotificationController exactly)
                await router.post('/push/subscribe', {
                    token: currentToken,
                    device_type: 'web'
                }, {
                    preserveState: true,
                    preserveScroll: true,
                    onSuccess: () => setIsSubscribed(true),
                    onError: (errors) => {
                        setError('Failed to save token to database');
                        console.log(errors);
                    }
                });
            } else {
                setError('No registration token available. Request permission to generate one.');
            }
        } catch (err) {
            setError('Failed to subscribe to FCM');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const unsubscribe = async () => {
        // 1. Get the messaging instance
        const messaging = getFcmMessaging();
        if (!messaging) return;

        setLoading(true);
        setError(null);

        try {
            const registration = await getOrRegisterServiceWorker();

            // 2. Pass the messaging instance to getToken
            const currentToken = await getToken(messaging, { serviceWorkerRegistration: registration });

            if (currentToken) {
                await router.post('/push/unsubscribe', {
                    token: currentToken
                }, {
                    preserveState: true,
                    preserveScroll: true,
                    onSuccess: async () => {
                        await deleteToken(messaging);
                        setIsSubscribed(false);
                    }
                });
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
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">Push notifications are not supported in your browser.</p>
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

            {permission === 'default' && (
                <Button onClick={requestPermission} disabled={loading} size={"sm"} variant={"outline"}>
                    <span className='text-sm'>Enable Browser Notifications</span>
                </Button>
            )}

            {permission === 'granted' && !isSubscribed && (
                <Button onClick={subscribeToPush} disabled={loading} size={"sm"} variant={"outline"}>
                    <span className='text-sm'>{loading ? 'Subscribing...' : 'Subscribe to Notifications'}</span>
                </Button>
            )}

            {permission === 'granted' && isSubscribed && (
                <Button onClick={unsubscribe} disabled={loading} size={"sm"}>
                    <span className='text-sm'>{loading ? 'Unsubscribing...' : 'Unsubscribe'}</span>
                </Button>
            )}

            {permission === 'denied' && (
                <p className="text-sm text-gray-600 text-center">
                    Notifications are blocked. Please enable them in your browser settings.
                </p>
            )}
        </div>
    );
}