/**
 * The order the customer was just sent to Thawani for, kept for this tab only
 * (sessionStorage), so coming back with the browser's Back button can offer
 * "Complete payment" instead of an empty cart. Holds only ids, never the link.
 */
const KEY = 'raf-pending-payment';

export type PendingPayment = { orderId: number; orderNumber: string };

export function rememberPendingPayment(pending: PendingPayment): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // Storage blocked (private mode): Back then shows the cart as usual.
  }
}

export function readPendingPayment(): PendingPayment | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingPayment>;
    return typeof value.orderId === 'number' &&
      Number.isInteger(value.orderId) &&
      value.orderId > 0 &&
      typeof value.orderNumber === 'string'
      ? { orderId: value.orderId, orderNumber: value.orderNumber }
      : null;
  } catch {
    return null;
  }
}

export function forgetPendingPayment(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up.
  }
}
