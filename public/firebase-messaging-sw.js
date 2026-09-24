// Firebase Cloud Messaging Service Worker
// Runs outside the app bundle, so it cannot read Inertia props. The Firebase
// web config is served by the backend (NotificationController::swConfig) and
// imported below — env changes must NOT require editing this file.
// FALLBACK_CONFIG is last-resort only (e.g. endpoint unreachable at install).

try {
    importScripts('/push/sw-config.js');
} catch (err) {
    console.warn('FCM SW: remote config failed to load, using fallback.', err);
}

const FALLBACK_CONFIG = {
    apiKey: 'AIzaSyDwLPU3m6tbA7UmD7wweysTILYzPKfqago',
    authDomain: 'frai-fc81c.firebaseapp.com',
    projectId: 'frai-fc81c',
    storageBucket: 'frai-fc81c.firebasestorage.app',
    messagingSenderId: '450348526079',
    appId: '1:450348526079:web:6194f45198b8c9ba801fca',
    measurementId: 'G-RD30CZ3WKM',
};

const firebaseConfig =
    self.__FIREBASE_CONFIG && self.__FIREBASE_CONFIG.projectId ? self.__FIREBASE_CONFIG : FALLBACK_CONFIG;

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// NOTE: keep the `notification` payload — Safari/iOS revoke push permission
// for silent (data-only) pushes. Always show immediately on receipt.
messaging.onBackgroundMessage(function (payload) {
    const data = payload.data || {};
    const notificationTitle = payload.notification?.title || 'Notification';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.tag || 'default',
        data,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Tapping the notification opens (or focuses) the `url` the backend embedded
// in data. Without this, taps do nothing — the top iOS complaint.
self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const target = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            const targetUrl = new URL(target, self.location.origin);

            for (const client of clientList) {
                if ('focus' in client && new URL(client.url).pathname === targetUrl.pathname) {
                    return client.focus();
                }
            }

            if (self.clients.openWindow) {
                return self.clients.openWindow(target);
            }

            return undefined;
        }),
    );
});
