importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyC28heBX9KUAK--AvXe1bTy06J9sss_C2Q",
  authDomain: "ckkk-576e7.firebaseapp.com",
  projectId: "ckkk-576e7",
  storageBucket: "ckkk-576e7.firebasestorage.app",
  messagingSenderId: "174398232186",
  appId: "1:174398232186:web:a94c68480f27e25a668dc3"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
