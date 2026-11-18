/**
 * Per-browser push and notification-language state (localStorage). Every access
 * can throw (private mode, blocked site data), so each one is guarded.
 */

const PUSH_TOKEN_KEY = 'raf-push-token';
const PUSH_OFF_KEY = 'raf-push-off';
const NOTIFICATION_LOCALE_KEY = 'raf-notification-locale';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Not stored: the next start simply registers again.
  }
}

/** This browser's FCM token as last registered with the backend. */
export function readPushToken(): string | null {
  return read(PUSH_TOKEN_KEY);
}

export function storePushToken(token: string | null): void {
  write(PUSH_TOKEN_KEY, token);
}

/** The customer turned browser push off here: don't register it again on start. */
export function isPushTurnedOff(): boolean {
  return read(PUSH_OFF_KEY) === '1';
}

export function setPushTurnedOff(off: boolean): void {
  write(PUSH_OFF_KEY, off ? '1' : null);
}

/** `userId:language` last sent to `PUT /notification-preferences {locale}`. */
export function readNotificationLocale(): string | null {
  return read(NOTIFICATION_LOCALE_KEY);
}

export function storeNotificationLocale(value: string | null): void {
  write(NOTIFICATION_LOCALE_KEY, value);
}
