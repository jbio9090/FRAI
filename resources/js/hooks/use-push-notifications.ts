import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';

export default function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false);
    const [subscription, setSubscription] = useState(null);
    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        // Check if browser supports notifications
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            registerServiceWorker();
        }
    }, []);

    const registerServiceWorker = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker registered:', registration);

            // Check existing subscription
            const existingSubscription = await registration.pushManager.getSubscription();
            if (existingSubscription) {
                setSubscription(existingSubscription);
                setIsSubscribed(true);
            }
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    };

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const subscribe = async () => {
        try {
            // Request permission
            const permission = await Notification.requestPermission();

            if (permission !== 'granted') {
                alert('Please allow notifications to receive updates!');
                return false;
            }

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // Subscribe to push notifications
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                    import.meta.env.VITE_VAPID_PUBLIC_KEY
                )
            });

            // Send subscription to server
            await fetch('/push-subscriptions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify(sub.toJSON())
            });

            setSubscription(sub);
            setIsSubscribed(true);
            return true;
        } catch (error) {
            console.error('Subscription failed:', error);
            return false;
        }
    };

    const unsubscribe = async () => {
        try {
            if (!subscription) return false;

            // Unsubscribe from push
            await subscription.unsubscribe();

            // Remove from server
            await fetch('/push-subscriptions', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({ endpoint: subscription.endpoint })
            });

            setSubscription(null);
            setIsSubscribed(false);
            return true;
        } catch (error) {
            console.error('Unsubscribe failed:', error);
            return false;
        }
    };

    return {
        isSupported,
        isSubscribed,
        subscribe,
        unsubscribe
    };
} 