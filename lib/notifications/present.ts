import type {
  CustomerNotification,
  Language,
  NotificationCategory,
  NotificationTarget,
} from '@/types';
import type { Dictionary } from '@/utils/translations';
import { REFUND_ACCOUNT_HREF } from '@/lib/account/refund-account';

/** Inbox tabs, in order (the backend's customer categories). */
export const NOTIFICATION_TABS: readonly NotificationCategory[] = [
  'orders',
  'shipping',
  'returns',
  'community',
  'announcements',
];

/**
 * A refund is waiting for the customer's bank account (guide §10.1): these
 * open the "Bank account for refunds" card instead of the order or return.
 */
function needsBankAccount(type: string | null | undefined, variant: string | null | undefined) {
  return (
    (type === 'refund_status' && variant === 'bank_details_needed') ||
    (type === 'order_cancelled' && variant === 'refund_needs_bank_details')
  );
}

/** Where a notification opens; `null` keeps it in the inbox (announcements). */
export function notificationHref(
  target: NotificationTarget | null,
  kind?: { type?: string | null; variant?: string | null },
): string | null {
  if (needsBankAccount(kind?.type, kind?.variant)) return REFUND_ACCOUNT_HREF;
  if (!target) return null;
  switch (target.type) {
    case 'order':
      return target.id ? `/account/orders/${target.id}` : '/account';
    case 'return':
      return '/returns';
    case 'product':
      // Products open by slug, never by id.
      return target.slug ? `/products/${encodeURIComponent(target.slug)}` : null;
    case 'bulk_order_request':
      return '/account/bulk-orders';
    default:
      return null;
  }
}

type NotificationsDict = Dictionary['notifications'];

const TYPE_FALLBACK: Record<string, keyof NotificationsDict> = {
  order_paid: 'typeOrderPaid',
  payment_failed: 'typePaymentFailed',
  order_cancelled: 'typeOrderCancelled',
  refund_status: 'typeRefundStatus',
  shipment_status_changed: 'typeShipmentStatusChanged',
  order_delivered: 'typeOrderDelivered',
  return_status_changed: 'typeReturnStatusChanged',
  product_question_answered: 'typeProductQuestionAnswered',
  bulk_order_request_updated: 'typeBulkOrderRequestUpdated',
  review_moderated: 'typeReviewModerated',
  review_replied: 'typeReviewReplied',
  announcement: 'typeAnnouncement',
};

/**
 * Text in the UI language: its own translation first, then what the backend
 * sent for this request, then the other language. Old rows can have no text
 * at all: a generic title by type.
 */
export function notificationText(
  notification: CustomerNotification,
  language: Language,
  t: Dictionary,
): { title: string; body: string | null } {
  const other = language === 'ar' ? 'en' : 'ar';
  const candidates = [
    notification.translations[language],
    { title: notification.title, body: notification.body },
    notification.translations[other],
  ];
  const title = candidates.map((c) => c?.title).find(Boolean);
  const body = candidates.map((c) => c?.body).find(Boolean) ?? null;
  const fallback = TYPE_FALLBACK[notification.type] ?? 'typeGeneric';
  return { title: title ?? t.notifications[fallback], body };
}

/**
 * Refund news gets a colour (guide §8.5): green once the money is back,
 * amber while it waits for a transfer or for the customer's bank account.
 * A cancelled order refunded to the card is green too, whether a store
 * cancelled its part (`refunded`) or RAF the whole order (`order_refunded`).
 */
export function notificationTone(
  notification: Pick<CustomerNotification, 'type' | 'variant'>,
): 'success' | 'attention' | null {
  const { type, variant } = notification;
  if (type === 'refund_status') {
    if (variant === 'transferred' || variant === 'late_payment_refunded') return 'success';
    if (variant === 'awaiting_transfer' || variant === 'bank_details_needed') return 'attention';
  }
  if (type === 'order_cancelled') {
    if (variant === 'refunded' || variant === 'order_refunded') return 'success';
    if (variant === 'refund_by_transfer' || variant === 'refund_needs_bank_details') {
      return 'attention';
    }
  }
  return null;
}

export function categoryLabel(category: NotificationCategory, t: Dictionary): string {
  switch (category) {
    case 'orders':
      return t.notifications.categoryOrders;
    case 'shipping':
      return t.notifications.categoryShipping;
    case 'returns':
      return t.notifications.categoryReturns;
    case 'community':
      return t.notifications.categoryCommunity;
    case 'announcements':
      return t.notifications.categoryAnnouncements;
    default:
      return t.notifications.categoryOther;
  }
}

/** "5 minutes ago" / "منذ 5 دقائق"; older than four weeks: the date. */
export function notificationTime(
  iso: string,
  now: number,
  language: Language,
  t: Dictionary,
): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const seconds = Math.round((time - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return t.notifications.justNow;
  const locale = language === 'ar' ? 'ar-OM' : 'en-GB';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), 'day');
  if (abs < 28 * 86400) return rtf.format(Math.round(seconds / (7 * 86400)), 'week');
  return new Date(time).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Badge text: "99+" past 99. */
export function unreadBadge(count: number): string {
  return count > 99 ? '99+' : String(count);
}
