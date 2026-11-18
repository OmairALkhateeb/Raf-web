import 'server-only';

import type {
  NotificationPreferences,
  NotificationUnread,
  NotificationsPage,
} from '@/types';
import {
  parseNotificationsPage,
  parsePreferences,
  parseUnread,
} from '@/lib/mappers/notifications';
import { interpretCustomerResult, type AccountOpResult } from './account';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

async function call<T>(
  method: Method,
  path: string,
  map: (data: unknown) => T | undefined,
  body?: Record<string, unknown>,
): Promise<AccountOpResult<T>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(path, {
      method,
      accessToken,
      body,
    }),
  );
  return interpretCustomerResult(attempt, (data) => map(data), (status) => status >= 200 && status < 300);
}

const ok = () => true;

export function listLaravelNotifications(query: {
  page: number;
  perPage: number;
  unread: boolean;
  category: string | null;
}): Promise<AccountOpResult<NotificationsPage>> {
  const params = new URLSearchParams({
    page: String(query.page),
    per_page: String(query.perPage),
  });
  if (query.unread) params.set('unread', '1');
  if (query.category) params.set('category', query.category);
  return call('GET', `/customer/notifications?${params.toString()}`, parseNotificationsPage);
}

export function getLaravelUnreadCount(): Promise<AccountOpResult<NotificationUnread>> {
  return call('GET', '/customer/notifications/unread-count', parseUnread);
}

export function markLaravelNotificationRead(id: string): Promise<AccountOpResult<true>> {
  return call('PATCH', `/customer/notifications/${encodeURIComponent(id)}/read`, () => ok() as true);
}

export function markAllLaravelNotificationsRead(
  category: string | null,
): Promise<AccountOpResult<true>> {
  return call(
    'POST',
    '/customer/notifications/mark-all-read',
    () => ok() as true,
    category ? { category } : {},
  );
}

export function deleteLaravelNotification(id: string): Promise<AccountOpResult<true>> {
  return call('DELETE', `/customer/notifications/${encodeURIComponent(id)}`, () => ok() as true);
}

export function deleteReadLaravelNotifications(): Promise<AccountOpResult<true>> {
  return call('DELETE', '/customer/notifications/read', () => ok() as true);
}

export function getLaravelNotificationPreferences(): Promise<AccountOpResult<NotificationPreferences>> {
  return call('GET', '/customer/notification-preferences', parsePreferences);
}

/** Register this browser's FCM token (upsert by token, safe to repeat). */
export function registerLaravelDeviceToken(input: {
  token: string;
  locale: 'en' | 'ar';
  deviceName: string | null;
}): Promise<AccountOpResult<true>> {
  return call('POST', '/customer/device-tokens', () => ok() as true, {
    token: input.token,
    platform: 'web',
    app: 'customer',
    locale: input.locale,
    ...(input.deviceName ? { device_name: input.deviceName } : {}),
  });
}

export function deleteLaravelDeviceToken(token: string): Promise<AccountOpResult<true>> {
  return call('DELETE', '/customer/device-tokens', () => ok() as true, { token });
}

/** Send only what changed: `{ locale }` and/or `{ preferences: { orders: { push: false } } }`. */
export function updateLaravelNotificationPreferences(
  body: Record<string, unknown>,
): Promise<AccountOpResult<NotificationPreferences>> {
  return call('PUT', '/customer/notification-preferences', parsePreferences, body);
}
