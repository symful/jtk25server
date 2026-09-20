import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  type Messaging,
} from 'firebase/messaging';

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
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');

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

async function apiSubscribe(token: string, topic: string): Promise<boolean> {
  try {
    const resp = await fetch('/api/v1/fcm/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, topic }),
    });
    if (!resp.ok) {
      console.error(`[FCM] subscribe failed for ${topic}: ${resp.status}`);
      return false;
    }
    console.log(`[FCM] subscribed to topic: ${topic}`);
    return true;
  } catch (e) {
    console.error(`[FCM] subscribe error for ${topic}:`, e);
    return false;
  }
}

async function apiUnsubscribe(token: string, topic: string): Promise<boolean> {
  try {
    const resp = await fetch('/api/v1/fcm/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, topic }),
    });
    if (!resp.ok) {
      console.error(`[FCM] unsubscribe failed for ${topic}: ${resp.status}`);
      return false;
    }
    console.log(`[FCM] unsubscribed from topic: ${topic}`);
    return true;
  } catch (e) {
    console.error(`[FCM] unsubscribe error for ${topic}:`, e);
    return false;
  }
}

export async function subscribeToClassTopic(classCode: string): Promise<void> {
  const m = await getFirebaseMessaging();
  if (!m) return;

  const token = await getToken(m, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
  });
  console.log('[FCM] token:', token.substring(0, 20) + '...');

  const classTopic = `jtk25_${classCode}`;
  await apiSubscribe(token, classTopic);
  await apiSubscribe(token, 'jtk25_global');
}

export async function unsubscribeFromAllTopics(): Promise<void> {
  const m = await getFirebaseMessaging();
  if (!m) return;

  const token = await getToken(m, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
  });
  await apiUnsubscribe(token, 'jtk25_global');
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'Notification' in window;
}
