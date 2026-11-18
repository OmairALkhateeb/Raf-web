import type {
  NotificationCategory,
  NotificationPreferences,
  NotificationUnread,
  NotificationsPage,
} from '@/types';
import {
  accountRequest,
  asError,
  type AccountClientResult,
} from '@/lib/api/account';
import type { AccountClientError } from '@/types/api/account';

function failure(json: unknown, status: number): AccountClientError {
  return asError(
    json,
    status === 401
      ? 'unauthenticated'
      : status === 404
        ? 'not_found'
        : status === 400 || status === 422
          ? 'invalid_input'
          : 'unavailable',
  );
}

async function send<T>(
  path: string,
  init: RequestInit | undefined,
  pick: (json: Record<string, unknown>) => T | undefined,
): Promise<AccountClientResult<T>> {
  const result = await accountRequest(path, init);
  if ('ok' in result) return result;
  if (!result.res.ok) return failure(result.json, result.res.status);
  const json = result.json as Record<string, unknown> | undefined;
  const data = json && json.ok === true ? pick(json) : undefined;
  return data === undefined ? { ok: false, code: 'unavailable' } : { ok: true, data };
}

export function fetchNotifications(query: {
  page: number;
  unreadOnly: boolean;
  category: NotificationCategory | null;
}): Promise<AccountClientResult<NotificationsPage>> {
  const params = new URLSearchParams({ page: String(query.page) });
  if (query.unreadOnly) params.set('unread', '1');
  if (query.category) params.set('category', query.category);
  return send(`/api/account/notifications?${params.toString()}`, undefined, (json) =>
    json.page as NotificationsPage | undefined,
  );
}

export function fetchUnreadCount(): Promise<AccountClientResult<NotificationUnread>> {
  return send('/api/account/notifications/unread-count', undefined, (json) =>
    json.unread as NotificationUnread | undefined,
  );
}

export function markNotificationRead(id: string): Promise<AccountClientResult<true>> {
  return send(
    `/api/account/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
    () => true,
  );
}

/** `category`: only that tab; `null`: everything. */
export function markAllNotificationsRead(
  category: NotificationCategory | null,
): Promise<AccountClientResult<true>> {
  return send(
    '/api/account/notifications/mark-all-read',
    { method: 'POST', body: JSON.stringify(category ? { category } : {}) },
    () => true,
  );
}

export function deleteNotification(id: string): Promise<AccountClientResult<true>> {
  return send(
    `/api/account/notifications/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    () => true,
  );
}

export function deleteReadNotifications(): Promise<AccountClientResult<true>> {
  return send('/api/account/notifications/read', { method: 'DELETE' }, () => true);
}

export function fetchNotificationPreferences(): Promise<
  AccountClientResult<NotificationPreferences>
> {
  return send('/api/account/notification-preferences', undefined, (json) =>
    json.preferences as NotificationPreferences | undefined,
  );
}

/** Send only what changed, e.g. `{ preferences: { orders: { push: false } } }` or `{ locale: 'ar' }`. */
export function updateNotificationPreferences(body: {
  locale?: 'en' | 'ar';
  preferences?: Partial<
    Record<NotificationCategory, Partial<Record<'push' | 'mail', boolean>>>
  >;
}): Promise<AccountClientResult<NotificationPreferences>> {
  return send(
    '/api/account/notification-preferences',
    { method: 'PUT', body: JSON.stringify(body) },
    (json) => json.preferences as NotificationPreferences | undefined,
  );
}

export function registerDeviceToken(input: {
  token: string;
  locale: 'en' | 'ar';
  deviceName: string;
}): Promise<AccountClientResult<true>> {
  return send(
    '/api/account/device-tokens',
    { method: 'POST', body: JSON.stringify(input) },
    () => true,
  );
}

export function deleteDeviceToken(token: string): Promise<AccountClientResult<true>> {
  return send(
    '/api/account/device-tokens',
    { method: 'DELETE', body: JSON.stringify({ token }) },
    () => true,
  );
}
