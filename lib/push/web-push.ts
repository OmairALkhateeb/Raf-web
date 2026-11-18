import type { MessagePayload, Messaging } from 'firebase/messaging';
import type { Language } from '@/types';
import { deleteDeviceToken, registerDeviceToken } from '@/lib/api/notifications';
import {
  isPushTurnedOff,
  readPushToken,
  setPushTurnedOff,
  storePushToken,
} from './storage';

/**
 * Browser push through Firebase Cloud Messaging, the same flow as the vendor
 * dashboard. Firebase is only downloaded once the NEXT_PUBLIC_FIREBASE_* values
 * are set in .env.local (restart `npm run dev` after changing them). Until then
 * the inbox and the bell still work by polling.
 */

// Written out one by one: Next.js only inlines `process.env.NEXT_PUBLIC_…` read directly.
const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ?? '',
};
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() ?? '';

/** Message the service worker posts to an open tab when a system notification is clicked. */
export const PUSH_OPEN_MESSAGE = 'raf-push-open';

/**
 * - `unconfigured`: Firebase keys missing in .env.local
 * - `unsupported`: this browser can't do web push
 * - `blocked`: the customer denied the browser permission
 * - `ask`: permission not asked yet
 * - `off`: permission granted, but not registered (turned off here, or not yet)
 * - `on`: this browser is registered with the backend
 */
export type PushState = 'unconfigured' | 'unsupported' | 'blocked' | 'ask' | 'off' | 'on';

export function isPushConfigured(): boolean {
  return Object.values(FIREBASE_CONFIG).every(Boolean) && Boolean(VAPID_KEY);
}

function hasBrowserSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window
  );
}

let messagingPromise: Promise<Messaging | null> | null = null;

function getMessagingInstance(): Promise<Messaging | null> {
  if (!isPushConfigured() || !hasBrowserSupport()) return Promise.resolve(null);
  messagingPromise ??= (async () => {
    const [{ getApps, initializeApp }, { getMessaging, isSupported }] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging'),
    ]);
    if (!(await isSupported())) return null;
    return getMessaging(getApps()[0] ?? initializeApp(FIREBASE_CONFIG));
  })().catch(() => null);
  return messagingPromise;
}

/**
 * The service worker can't read .env, so the config (and the SDK version, for
 * the matching Firebase scripts) goes in its URL. A new URL replaces the registration.
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const { SDK_VERSION } = await import('firebase/app');
  const params = new URLSearchParams({ ...FIREBASE_CONFIG, v: SDK_VERSION });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
}

export async function getPushState(): Promise<PushState> {
  if (!isPushConfigured()) return 'unconfigured';
  if (!(await getMessagingInstance())) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission === 'default') return 'ask';
  return !isPushTurnedOff() && readPushToken() ? 'on' : 'off';
}

/** Register silently on start / login / language change, only if the customer already said yes. */
export function canAutoRegister(): boolean {
  return (
    isPushConfigured() &&
    hasBrowserSupport() &&
    Notification.permission === 'granted' &&
    !isPushTurnedOff()
  );
}

/** e.g. "Chrome on Windows" (Laravel keeps up to 190 characters). */
function deviceName(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return (os ? `${browser} on ${os}` : browser).slice(0, 190);
}

/**
 * Get this browser's FCM token and register it (`POST /customer/device-tokens`).
 * The token is kept so logout can unregister it. Throws when Firebase or the backend refuses.
 */
export async function registerPushDevice(language: Language): Promise<string> {
  const messaging = await getMessagingInstance();
  if (!messaging) throw new Error('Web push is not available in this browser.');
  const { getToken } = await import('firebase/messaging');
  const serviceWorkerRegistration = await registerServiceWorker();
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration });
  if (!token) throw new Error('Firebase returned no push token.');

  const previous = readPushToken();
  const result = await registerDeviceToken({ token, locale: language, deviceName: deviceName() });
  if (!result.ok) throw new Error(`Device registration failed: ${result.code}`);
  storePushToken(token);
  // Firebase rotated the token: drop the old one (the backend also prunes it once FCM rejects it).
  if (previous && previous !== token) void deleteDeviceToken(previous);
  return token;
}

/** Ask for permission (needs a click), then register. Resolves to the resulting state. */
export async function enablePush(language: Language): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'blocked';
  if (permission !== 'granted') return 'ask';
  setPushTurnedOff(false);
  await registerPushDevice(language);
  return 'on';
}

/** Unregister this browser and remember the choice, so the next start doesn't register it again. */
export async function disablePush(): Promise<void> {
  const token = readPushToken();
  if (token) {
    const result = await deleteDeviceToken(token);
    if (!result.ok && result.code !== 'not_found') {
      throw new Error(`Device removal failed: ${result.code}`);
    }
  }
  storePushToken(null);
  setPushTurnedOff(true);
  const messaging = await getMessagingInstance();
  if (messaging) {
    const { deleteToken } = await import('firebase/messaging');
    await deleteToken(messaging).catch(() => undefined);
  }
}

/** Messages that arrive while a store tab is open (no system notification is shown then). */
export async function subscribeToForegroundPush(
  handler: (payload: MessagePayload) => void,
): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => undefined;
  const { onMessage } = await import('firebase/messaging');
  return onMessage(messaging, handler);
}
