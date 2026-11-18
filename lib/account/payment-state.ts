import type { AccountOrderPaymentSummary, AccountOrderStatus } from '@/types';

/**
 * What an order shows about its payment (Thawani guide §4.6). The one place
 * that decides it, for the orders list, the order page and the return pages.
 */
export type OrderPaymentState =
  /** A: waiting for payment, the pay page is open → "Complete payment". */
  | 'awaiting_payment'
  /** B: the last attempt was cancelled, still in time → "Try again". */
  | 'payment_cancelled_retry'
  /** C: the time to pay is over; the backend cancels it within ~15 minutes. */
  | 'payment_window_over'
  /** D: cancelled because it wasn't paid in time. */
  | 'failed'
  /** E: paid (processing, ready to ship, shipped, delivered). */
  | 'paid'
  /** F: cancelled after payment; the money is being or was refunded. */
  | 'cancelled_refunded'
  /** G: cancelled before payment; nothing to refund. */
  | 'cancelled_unpaid';

export type OrderPaymentFields = {
  status: AccountOrderStatus;
  paymentStatus: string | null;
  payment: AccountOrderPaymentSummary | null;
  paymentExpiresAt: string | null;
};

/** The payment deadline in ms, or `null` when there is none. */
export function paymentDeadline(
  order: Pick<OrderPaymentFields, 'paymentExpiresAt'>,
): number | null {
  if (!order.paymentExpiresAt) return null;
  const at = Date.parse(order.paymentExpiresAt);
  return Number.isFinite(at) ? at : null;
}

export function getOrderPaymentState(
  order: OrderPaymentFields,
  now: number,
): OrderPaymentState {
  switch (order.status) {
    case 'failed':
      return 'failed';
    case 'cancelled':
      return order.paymentStatus === 'paid' ? 'cancelled_refunded' : 'cancelled_unpaid';
    case 'pending_payment': {
      // Compare with the deadline here: the backend only closes the order
      // when its next check runs, up to 15 minutes later.
      const deadline = paymentDeadline(order);
      if (deadline !== null && now >= deadline) return 'payment_window_over';
      return order.payment?.status === 'failed' ? 'payment_cancelled_retry' : 'awaiting_payment';
    }
    default:
      // `paid` (no longer used), processing, ready_to_ship, shipped, delivered.
      // Never decide this from sub_orders[].status: they say "processing"
      // from checkout, before payment.
      return 'paid';
  }
}

/** A and B: the customer can still pay, so a countdown is shown. */
export function isPayableState(state: OrderPaymentState): boolean {
  return state === 'awaiting_payment' || state === 'payment_cancelled_retry';
}

/** C, D, F, G: the order can't be paid any more. */
export function isClosedState(state: OrderPaymentState): boolean {
  return (
    state === 'payment_window_over' ||
    state === 'failed' ||
    state === 'cancelled_refunded' ||
    state === 'cancelled_unpaid'
  );
}

/**
 * The Thawani page behind "Complete payment" (state A only). `null` with the
 * mock gateway, which has no page: the order then waits for the admin.
 */
export function completePaymentUrl(order: OrderPaymentFields, now: number): string | null {
  return getOrderPaymentState(order, now) === 'awaiting_payment'
    ? (order.payment?.redirectUrl ?? null)
    : null;
}

/** "59:07" or "1:02:05" until the deadline (never negative). */
export function formatTimeLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
