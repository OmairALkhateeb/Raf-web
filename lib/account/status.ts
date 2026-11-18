import type { AccountOrderStatus } from '@/types';
import { getOrderPaymentState, type OrderPaymentFields } from './payment-state';

const ORDER_STATUSES: readonly AccountOrderStatus[] = [
  'pending_payment',
  'paid',
  'processing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'failed',
];

export function isAccountOrderStatus(
  value: string,
): value is AccountOrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

type OrderStatusLabels = {
  pendingPayment: string;
  paid: string;
  processing: string;
  readyToShip: string;
  shipped: string;
  delivered: string;
  cancelled: string;
  failed: string;
};

export function orderStatusPresentation(
  status: AccountOrderStatus,
  labels: OrderStatusLabels,
): { bg: string; text: string; label: string } {
  switch (status) {
    case 'pending_payment':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        label: labels.pendingPayment,
      };
    case 'paid':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        label: labels.paid,
      };
    case 'processing':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        label: labels.processing,
      };
    case 'ready_to_ship':
      return {
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        label: labels.readyToShip,
      };
    case 'shipped':
      return { bg: 'bg-blue-50', text: 'text-blue-700', label: labels.shipped };
    case 'delivered':
      return {
        bg: 'bg-[#C9A84C]/10',
        text: 'text-[#C9A84C]',
        label: labels.delivered,
      };
    case 'cancelled':
      return { bg: 'bg-red-50', text: 'text-red-600', label: labels.cancelled };
    case 'failed':
      return { bg: 'bg-red-50', text: 'text-red-700', label: labels.failed };
  }
}

type PaymentStateLabels = OrderStatusLabels & {
  awaitingPayment: string;
  paymentNotCompleted: string;
  paymentTimeOver: string;
  cancelledNotPaid: string;
};

/**
 * The order's badge in the list and on its page: the payment state while it
 * isn't paid (guide §4.6), its usual status otherwise. `now` decides "time over".
 */
export function orderBadge(
  order: OrderPaymentFields,
  now: number,
  labels: PaymentStateLabels,
): { bg: string; text: string; label: string } {
  switch (getOrderPaymentState(order, now)) {
    case 'awaiting_payment':
      return { bg: 'bg-amber-50', text: 'text-amber-700', label: labels.awaitingPayment };
    case 'payment_cancelled_retry':
      return { bg: 'bg-amber-50', text: 'text-amber-800', label: labels.paymentNotCompleted };
    case 'payment_window_over':
      return { bg: 'bg-[#2D1F1F]/5', text: 'text-[#2D1F1F]/60', label: labels.paymentTimeOver };
    case 'failed':
      return { bg: 'bg-red-50', text: 'text-red-700', label: labels.cancelledNotPaid };
    default:
      return orderStatusPresentation(order.status, labels);
  }
}

type PaymentStatusLabels = {
  paymentPending: string;
  paymentPaid: string;
  paymentFailed: string;
};

export function paymentStatusLabel(
  status: string,
  labels: PaymentStatusLabels,
): string {
  switch (status) {
    case 'pending':
      return labels.paymentPending;
    case 'paid':
      return labels.paymentPaid;
    case 'failed':
      return labels.paymentFailed;
    default:
      return status.replaceAll('_', ' ');
  }
}

type ShippingStatusLabels = {
  shippingPending: string;
  shippingReadyForPickup: string;
  shippingPickedUp: string;
  shippingInTransit: string;
  shippingOutForDelivery: string;
  shippingDelivered: string;
  shippingFailedDelivery: string;
  shippingReturned: string;
};

export function shippingStatusLabel(
  status: string,
  labels: ShippingStatusLabels,
): string {
  switch (status) {
    case 'pending':
      return labels.shippingPending;
    case 'ready_for_pickup':
      return labels.shippingReadyForPickup;
    case 'picked_up':
      return labels.shippingPickedUp;
    case 'in_transit':
      return labels.shippingInTransit;
    case 'out_for_delivery':
      return labels.shippingOutForDelivery;
    case 'delivered':
      return labels.shippingDelivered;
    case 'failed_delivery':
      // An attempt the courier will retry, not the end (15/10/2026).
      return labels.shippingFailedDelivery;
    case 'returned':
      // Final: the courier brought it back to the seller; refunded in full.
      return labels.shippingReturned;
    default:
      return status.replaceAll('_', ' ');
  }
}
