import type { AccountOrderDetail, AccountOrderRefund } from '@/types';

/**
 * What a refund line says (guide §9.4). `hasBankAccount` is `null` while the
 * profile isn't known yet: then a transfer just says it's on its way.
 */
export type RefundLineKind =
  | 'card_done'
  | 'transfer_done'
  | 'transfer_waiting'
  | 'transfer_needs_account'
  | 'in_progress';

export function refundLineKind(
  refund: Pick<AccountOrderRefund, 'status' | 'method'>,
  hasBankAccount: boolean | null,
): RefundLineKind {
  if (refund.status === 'succeeded') {
    return refund.method === 'bank_transfer' ? 'transfer_done' : 'card_done';
  }
  if (refund.status === 'awaiting_transfer') {
    return hasBankAccount === false ? 'transfer_needs_account' : 'transfer_waiting';
  }
  // pending, failed (the gateway is retried; never shown as an error), or new values.
  return 'in_progress';
}

/**
 * Where each refund goes on the order page: on the store's part it refunds,
 * next to the item's return, or at order level. A whole cancelled order
 * keeps them together at order level: the backend files a full refund under
 * the last sub-order cancelled, which isn't that store's share.
 */
export function placeRefunds(order: Pick<AccountOrderDetail, 'status' | 'refunds' | 'subOrders' | 'items'>) {
  const bySubOrder = new Map<number, AccountOrderRefund[]>();
  const byReturn = new Map<number, AccountOrderRefund[]>();
  const orderLevel: AccountOrderRefund[] = [];
  const wholeOrderClosed = order.status === 'cancelled' || order.status === 'failed';
  const subOrderIds = new Set(order.subOrders.map((subOrder) => subOrder.id));
  const returnIds = new Set(
    order.items.flatMap((item) => (item.returnRequest ? [item.returnRequest.id] : [])),
  );

  for (const refund of order.refunds) {
    if (!wholeOrderClosed && refund.subOrderId !== null && subOrderIds.has(refund.subOrderId)) {
      bySubOrder.set(refund.subOrderId, [...(bySubOrder.get(refund.subOrderId) ?? []), refund]);
    } else if (refund.returnRequestId !== null && returnIds.has(refund.returnRequestId)) {
      byReturn.set(refund.returnRequestId, [...(byReturn.get(refund.returnRequestId) ?? []), refund]);
    } else {
      orderLevel.push(refund);
    }
  }
  return { bySubOrder, byReturn, orderLevel };
}

/** Already given back vs still on its way, from `refunds[]` (not `refunded_total`). */
export function refundTotals(refunds: AccountOrderRefund[]): { done: number; pending: number } {
  let done = 0;
  let pending = 0;
  for (const refund of refunds) {
    if (refund.status === 'succeeded') done += refund.amount;
    else pending += refund.amount;
  }
  // Amounts are in baisa precision (3 decimals).
  return { done: Math.round(done * 1000) / 1000, pending: Math.round(pending * 1000) / 1000 };
}

export function hasAwaitingTransfer(refunds: Pick<AccountOrderRefund, 'status'>[]): boolean {
  return refunds.some((refund) => refund.status === 'awaiting_transfer');
}
