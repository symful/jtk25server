import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, type Messaging } from 'firebase/messaging';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!('serviceWorker' in navigator)) return null;
  if (!('Notification' in window)) return null;

  try {
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
    );

    if (!messaging) {
      messaging = getMessaging(getFirebaseApp());
    }
    return messaging;
  } catch (e) {
    console.error('[FCM] Service worker registration failed:', e);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToClassTopic(classCode: string): Promise<void> {
  const m = await getFirebaseMessaging();
  if (!m) return;

  const { getToken } = await import('firebase/messaging');
  const token = await getToken(m, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
  });

  console.log('[FCM] token:', token.substring(0, 20) + '...');
  // Topic subscription is handled server-side via FCM API
}

export async function unsubscribeFromAllTopics(): Promise<void> {
  // Topic unsubscription is handled server-side
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'Notification' in window;
}
