// Service Worker for Push Notifications

self.addEventListener('push', function (event) {
    const data = event.data ? event.data.json() : {};

    const options = {
        body: data.body || 'You have a new notification',
        icon: data.icon || '/apple-touch-icon.png',
        data: data.data || {},
        actions: data.actions || [],
        tag: data.tag || 'default-tag',
        requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(self.registration.showNotification(data.title || 'Notification', options));
});

self.addEventListener('notificationclick', function (event) {
    // Close the notification immediately upon interaction
    event.notification.close();

    const action = event.action;
    const data = event.notification.data || {};

    // Handle the Dynamic Recommended Action Click
    if (action === 'recommended_action' && data.recommended_action_url) {
        event.waitUntil(
            fetch(data.recommended_action_url, {
                method: 'POST',
                headers: { Accept: 'application/json' },
            })
                .then((response) => {
                    if (response.ok) {
                        self.registration.showNotification('Success: Request processed based on recommendation.');
                    }
                })
                .catch((error) => console.error('Recommended action failed', error)),
        );
    } else if (action === 'deny_action' && data.deny_url) {
        event.waitUntil(
            fetch(data.deny_url, {
                method: 'POST',
                headers: { Accept: 'application/json' },
            })
                .then((response) => {
                    if (response.ok) {
                        self.registration.showNotification('Request Denied');
                    }
                })
                .catch((error) => console.error('Denial failed', error)),
        );
    } else {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
                return clients.openWindow(data.url || '/');
            }),
        );
    }
});

self.addEventListener('notificationclose', function (event) {
    console.log('Notification closed:', event.notification.tag);
});
