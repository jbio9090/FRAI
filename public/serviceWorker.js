// Service Worker for Push Notifications

self.addEventListener('push', function (event) {
    const data = event.data ? event.data.json() : {};

    const options = {
        body: data.body || 'You have a new notification',
        icon: data.icon || '/apple-touch-icon.png',
        data: data.data || {},
        actions: data.actions || [],
        tag: data.tag || 'default-tag',
        requireInteraction: data.requireInteraction || false
    };

    event.waitUntil(
        self.registration.showNotification(
            data.title || 'Notification',
            options
        )
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (clientList) {
                return clients.openWindow(event.notification.data.url || '/');
            })
    );
});

self.addEventListener('notificationclose', function (event) {
    console.log('Notification closed:', event.notification.tag);
});
