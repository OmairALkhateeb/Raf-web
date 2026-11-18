import 'server-only';

import type {
  CustomerNotification,
  NotificationCategory,
  NotificationPreference,
  NotificationPreferences,
  NotificationText,
  NotificationUnread,
  NotificationsPage,
} from '@/types';

const CATEGORIES: readonly NotificationCategory[] = [
  'orders',
  'shipping',
  'returns',
  'community',
  'announcements',
  'other',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function category(value: unknown): NotificationCategory {
  return (CATEGORIES as readonly unknown[]).includes(value)
    ? (value as NotificationCategory)
    : 'other';
}

function translation(value: unknown): NotificationText | null {
  const record = asRecord(value);
  if (!record) return null;
  const title = text(record.title);
  const body = text(record.body);
  return title || body ? { title, body } : null;
}

export function parseNotification(raw: unknown): CustomerNotification | null {
  const dto = asRecord(raw);
  const id = text(dto?.id);
  const createdAt = text(dto?.created_at);
  if (!dto || !id || !createdAt) return null;

  const translations = asRecord(dto.translations);
  const targetRaw = asRecord(dto.target);
  const targetType = text(targetRaw?.type);
  const targetId = Number(targetRaw?.id);

  return {
    id,
    type: text(dto.type) ?? 'notification',
    category: category(dto.category),
    title: text(dto.title),
    body: text(dto.body),
    translations: {
      en: translation(translations?.en),
      ar: translation(translations?.ar),
    },
    target: targetType
      ? {
          type: targetType,
          id: Number.isInteger(targetId) && targetId > 0 ? targetId : null,
          slug: text(targetRaw?.slug),
        }
      : null,
    // NotificationResource keeps it in the stored payload (`data.variant`).
    variant: text(dto.variant) ?? text(asRecord(dto.data)?.variant),
    isRead: dto.is_read === true || Boolean(text(dto.read_at)),
    createdAt,
  };
}

export function parseNotificationsPage(raw: unknown): NotificationsPage | undefined {
  const record = asRecord(raw);
  if (!record || !Array.isArray(record.data)) return undefined;
  const meta = asRecord(record.meta);
  const notifications = record.data
    .map(parseNotification)
    .filter((n): n is CustomerNotification => n !== null);
  return {
    notifications,
    currentPage: Number(meta?.current_page) || 1,
    lastPage: Number(meta?.last_page) || 1,
    total: Number(meta?.total) || notifications.length,
  };
}

export function parseUnread(raw: unknown): NotificationUnread | undefined {
  const record = asRecord(raw);
  const count = Number(record?.unread_count);
  if (!record || !Number.isFinite(count)) return undefined;
  const byCategory: NotificationUnread['byCategory'] = {};
  // `{}` when nothing is unread (an empty JSON object or array).
  for (const [key, value] of Object.entries(asRecord(record.by_category) ?? {})) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) byCategory[category(key)] = n;
  }
  return { unreadCount: Math.max(0, count), byCategory };
}

export function parsePreferences(raw: unknown): NotificationPreferences | undefined {
  const record = asRecord(raw);
  if (!record || !Array.isArray(record.data)) return undefined;
  const items: NotificationPreference[] = [];
  for (const row of record.data) {
    const dto = asRecord(row);
    const cat = text(dto?.category);
    if (!dto || !cat) continue;
    const label = asRecord(dto.label);
    items.push({
      category: category(cat),
      label: {
        en: text(label?.en) ?? cat,
        ar: text(label?.ar) ?? text(label?.en) ?? cat,
      },
      mandatory: dto.mandatory === true,
      push: dto.push === true,
      mail: dto.mail === true,
    });
  }
  return { locale: record.locale === 'ar' ? 'ar' : 'en', items };
}
