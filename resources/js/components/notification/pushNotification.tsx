import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

export default function PushNotifications() {
    const [permission, setPermission] = useState(Notification.permission);
    const [subscription, setSubscription] = useState(null);
    const [isSupported, setIsSupported] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Check if push notifications are supported
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            checkSubscription();
        }
    }, []);

    const checkSubscription = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.getSubscription();
            setSubscription(sub);
        } catch (err) {
            console.error('Error checking subscription:', err);
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
            console.error(err);
        }
    };

    const subscribeToPush = async () => {
        setLoading(true);
        setError(null);

        try {
            const registration = await navigator.serviceWorker.ready;
            const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            await router.post('/push/subscribe', {
                subscription: subscription.toJSON()
            }, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    setSubscription(subscription);
                },
                onError: (errors) => {
                    setError('Failed to save subscription');
                    console.log(errors);
                }
            });
        } catch (err) {
            setError('Failed to subscribe to push notifications');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const unsubscribe = async () => {
        setLoading(true);
        setError(null);

        try {
            if (subscription) {
                await router.post('/push/unsubscribe', {
                    subscription: subscription.toJSON()
                }, {
                    preserveState: true,
                    preserveScroll: true,
                });

                await subscription.unsubscribe();
                setSubscription(null);
            }
        } catch (err) {
            setError('Failed to unsubscribe');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Helper function to convert VAPID key
    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    if (!isSupported) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                    Push notifications are not supported in your browser.
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
            {permission === 'default' && (
                <Button
                    onClick={requestPermission}
                    disabled={loading}
                    size={"sm"}
                    variant={"outline"}
                >
                    <span className='text-xs'>
                        Enable Browser Notifications
                    </span>
                </Button>
            )}

            {permission === 'granted' && !subscription && (
                <Button
                    onClick={subscribeToPush}
                    disabled={loading}
                    size={"sm"}
                    variant={"outline"}
                >
                    <span className='text-xs'>
                        {loading ? 'Subscribing...' : 'Subscribe to Notifications'}
                    </span>
                </Button>
            )}

            {permission === 'granted' && subscription && (
                <Button
                    onClick={unsubscribe}
                    disabled={loading}
                    size={"sm"}
                >
                    <span className='text-xs'>
                        {loading ? 'Unsubscribing...' : 'Unsubscribe'}
                    </span>
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