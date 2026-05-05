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

    const findActionUrl = (act) => {
        if (!act) return null;
        if (data.action_urls && data.action_urls[act]) return data.action_urls[act];
        if (data[act + '_url']) return data[act + '_url'];
        if (act === 'recommended_action' && data.recommended_action_url) return data.recommended_action_url;
        if (act === 'deny_action' && data.deny_url) return data.deny_url;
        return null;
    };

    const actionUrl = findActionUrl(action);

    if (actionUrl) {
        event.waitUntil(
            fetch(actionUrl, { method: 'GET', headers: { Accept: 'application/json' } })
                .then(async (response) => {
                    const contentType = response.headers.get('content-type') || '';
                    if (response.ok) {
                        let payload = null;
                        try {
                            if (contentType.includes('application/json')) {
                                payload = await response.json().catch(() => null);
                            } else {
                                payload = await response.text().catch(() => null);
                            }
                        } catch (e) {
                            payload = null;
                        }

                        const title = payload && payload.message ? payload.message : 'Action completed';
                        return self.registration.showNotification(title);
                    }

                    // Non-OK response: try to read body for a message
                    let bodyText = '';
                    try {
                        if (contentType.includes('application/json')) {
                            const bodyJson = await response.json().catch(() => null);
                            bodyText = bodyJson && bodyJson.message ? bodyJson.message : JSON.stringify(bodyJson);
                        } else {
                            bodyText = await response.text().catch(() => '');
                        }
                    } catch (e) {
                        bodyText = '';
                    }

                    console.error('Push action failed', response.status, bodyText);

                    return self.registration.showNotification('Action failed');
                })
                .catch((error) => {
                    console.error('Push action fetch error', error);
                    return self.registration.showNotification('Action failed');
                })
        );
    } else {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url === data.url && 'focus' in client) {
                        return client.focus();
                    }
                }
                return clients.openWindow(data.url || '/');
            }),
        );
    }
});

self.addEventListener('notificationclose', function (event) {
    console.log('Notification closed:', event.notification.tag);
});
