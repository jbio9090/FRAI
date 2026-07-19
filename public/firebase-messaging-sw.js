// Firebase Cloud Messaging Service Worker
// Uses compat SDK via importScripts — this runs outside the app bundle

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: 'AIzaSyDwLPU3m6tbA7UmD7wweysTILYzPKfqago',
    authDomain: 'frai-fc81c.firebaseapp.com',
    projectId: 'frai-fc81c',
    storageBucket: 'frai-fc81c.firebasestorage.app',
    messagingSenderId: '450348526079',
    appId: '1:450348526079:web:6194f45198b8c9ba801fca',
    measurementId: 'G-RD30CZ3WKM',
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    const notificationTitle = payload.notification?.title || 'Notification';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/FRAI.png',
        data: payload.data || {},
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
