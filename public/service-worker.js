self.addEventListener('push', function (event) {
    if (!(self.Notification && self.Notification.permission === 'granted')) {
        return;
    }

    const data = event.data?.json() ?? {};
    const title = data.title || 'New Notification';
    const options = {
        body: data.body || '',
        icon: data.icon || '/icon.png',
        badge: data.badge || '/badge.png',
        data: data.data || {},
        actions: data.actions || [],
        tag: data.tag || 'default',
        requireInteraction: data.requireInteraction || false,
        vibrate: data.vibrate || [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const data = event.notification.data;

    if (event.action === 'view_request') {
        event.waitUntil(
            clients.openWindow(`/request/${data.request_id}`)
        );
    } else {
        event.waitUntil(
            clients.openWindow('/requests')
        );
    }
});