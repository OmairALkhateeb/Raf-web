import type { AccountOrderDetail } from '@/types';
import type { AccountClientError } from '@/types/api/account';
import { retryOrderPayment } from '@/lib/api/account';
import { completePaymentUrl, type OrderPaymentFields } from '@/lib/account/payment-state';
import { rememberPendingPayment } from './pending-payment';

export type StartPaymentResult =
  /** The browser is on its way to Thawani. */
  | { ok: true; redirected: true }
  /** No page to open: paid in the meantime, or the mock gateway. */
  | { ok: true; redirected: false; order: AccountOrderDetail }
  | AccountClientError;

/**
 * "Complete payment" / "Try again" (guide §6.3): opens the order's open
 * Thawani page as it is (state A), or asks for a new one after a cancelled
 * attempt (state B, `retry-payment`). Same tab — Thawani and bank 3-D Secure
 * pages don't work in a popup or iframe.
 */
export async function startPayment(
  order: OrderPaymentFields & { id: number; orderNumber: string },
): Promise<StartPaymentResult> {
  let target: OrderPaymentFields & { id: number; orderNumber: string } = order;
  let url = completePaymentUrl(target, Date.now());
  if (!url) {
    const result = await retryOrderPayment(order.id);
    if (!result.ok) return result;
    target = result.data;
    url = completePaymentUrl(target, Date.now());
  }
  if (!url) {
    // Only a retry answer (a full order) gets here without a link.
    return { ok: true, redirected: false, order: target as AccountOrderDetail };
  }

  rememberPendingPayment({ orderId: target.id, orderNumber: target.orderNumber });
  window.location.assign(url);
  return { ok: true, redirected: true };
}
