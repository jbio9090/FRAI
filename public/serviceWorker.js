// Firebase Messaging service worker
// Replace the placeholders below with your Firebase config values. If you use Vite,
// you can inject environment variables during build and copy this file to `public/`.

importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDwLPU3m6tbA7UmD7wweysTILYzPKfqago",
    authDomain: "frai-fc81c.firebaseapp.com",
    projectId: "frai-fc81c",
    messagingSenderId: "450348526079",
    appId: "1:450348526079:web:6194f45198b8c9ba801fca",
});

const firebaseConfig = {
    apiKey: "AIzaSyDwLPU3m6tbA7UmD7wweysTILYzPKfqago",
    authDomain: "frai-fc81c.firebaseapp.com",
    projectId: "frai-fc81c",
    storageBucket: "frai-fc81c.firebasestorage.app",
    messagingSenderId: "450348526079",
    appId: "1:450348526079:web:6194f45198b8c9ba801fca",
    measurementId: "G-SVY8Y1B9NJ"
};

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    const notification = payload.notification || {};
    const data = payload.data || {};
    const title = notification.title || data.title || 'Notification';
    const options = {
        body: notification.body || data.body || '',
        icon: data.icon || '/FRAI.png',
        data: data,
    };

    self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const data = event.notification.data || {};
    const url = data.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (const client of clientList) {
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});

self.addEventListener('notificationclose', function (event) {
    console.log('Notification closed:', event.notification.tag);
});
