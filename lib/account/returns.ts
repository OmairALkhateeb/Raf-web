import { parsePositiveIntString } from '@/lib/cart/ids';
import { readRefundAccountBody, type RefundAccountInput } from '@/lib/account/refund-account';
import type { AccountRefundStatus, AccountReturnStatus } from '@/types';

export type ReturnCreateInput = {
  orderItemId: number;
  quantity: number;
  /** Reason code, not free text. */
  reason: string;
  note: string | null;
  /**
   * Sent only when the customer typed one (guide §5.6): the backend saves it
   * to the profile, where refunds for returns are sent.
   */
  refundAccount?: RefundAccountInput;
};

const RETURN_REASON_CODE = /^[a-z][a-z_]*$/;

/**
 * Customer wording for a completed return's refund; `null` = say nothing.
 * `succeeded` says only "Refunded": a return doesn't say whether it went back
 * on the card or by transfer (the order's refund lines do). `failed` is
 * retried by the backend, so it reads as "being processed", not an error.
 */
export function refundStatusPresentation(
  status: AccountRefundStatus | null,
  labels: {
    refundSucceeded: string;
    refundFailed: string;
    refundPending: string;
    refundAwaitingTransfer: string;
  },
): { text: string; className: string } | null {
  switch (status) {
    case 'succeeded':
      return { text: labels.refundSucceeded, className: 'text-emerald-700' };
    case 'awaiting_transfer':
      return { text: labels.refundAwaitingTransfer, className: 'text-amber-800' };
    case 'failed':
      return { text: labels.refundFailed, className: 'text-amber-700' };
    case 'pending':
      return { text: labels.refundPending, className: 'text-[#2D1F1F]/60' };
    default:
      return null;
  }
}

/** Most return copy needs the Arabic label with an English fallback. */
export function localizedLabel(
  label: string,
  labelAr: string | null,
  language: 'en' | 'ar',
): string {
  return language === 'ar' && labelAr ? labelAr : label;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function readRequiredTrimmed(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function readOptionalNote(value: unknown): string | null | undefined {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 2000) return undefined;
  return trimmed ? trimmed : null;
}

export function parseReturnIdParam(raw: string): number | null {
  return parsePositiveIntString(raw);
}

export function parseOrderItemIdQuery(raw: string | null): number | null {
  if (!raw) return null;
  return parsePositiveIntString(raw);
}

/**
 * Accepts camelCase from the storefront client or snake_case.
 */
export function parseReturnCreateBody(body: unknown): ReturnCreateInput | null {
  const record = asObject(body);
  if (!record) return null;

  const orderItemRaw =
    record.orderItemId !== undefined
      ? record.orderItemId
      : record.order_item_id;
  const orderItemId =
    typeof orderItemRaw === 'number'
      ? Number.isInteger(orderItemRaw) && orderItemRaw > 0
        ? orderItemRaw
        : null
      : typeof orderItemRaw === 'string'
        ? parsePositiveIntString(orderItemRaw)
        : null;
  if (orderItemId === null) return null;

  const quantityRaw = record.quantity;
  const quantity =
    typeof quantityRaw === 'number'
      ? Number.isInteger(quantityRaw) && quantityRaw >= 1
        ? quantityRaw
        : null
      : typeof quantityRaw === 'string'
        ? parsePositiveIntString(quantityRaw)
        : null;
  if (quantity === null) return null;

  // A reason code from GET /customer/returns/reasons (`damaged`, `other`, …).
  // The backend checks it is one of its codes, and that `other` has a note.
  const reason = readRequiredTrimmed(record.reason, 50);
  if (!reason || !RETURN_REASON_CODE.test(reason)) return null;

  const note = readOptionalNote(record.note);
  if (note === undefined) return null;

  const ibanRaw = record.refundIban ?? record.refund_iban;
  if (ibanRaw === undefined || ibanRaw === null || ibanRaw === '') {
    return { orderItemId, quantity, reason, note };
  }
  const refundAccount = readRefundAccountBody({
    iban: ibanRaw,
    accountName: record.refundAccountName ?? record.refund_account_name,
  });
  if (!refundAccount) return null;
  return { orderItemId, quantity, reason, note, refundAccount };
}

type ReturnStatusLabels = {
  returnPending: string;
  returnApproved: string;
  returnRejected: string;
  returnCompleted: string;
  returnCancelled: string;
};

export function returnStatusPresentation(
  status: AccountReturnStatus,
  labels: ReturnStatusLabels,
): { bg: string; text: string; label: string } {
  switch (status) {
    case 'pending':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        label: labels.returnPending,
      };
    case 'approved':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        label: labels.returnApproved,
      };
    case 'rejected':
      return {
        bg: 'bg-red-50',
        text: 'text-red-600',
        label: labels.returnRejected,
      };
    case 'completed':
      return {
        bg: 'bg-[#C9A84C]/10',
        text: 'text-[#C9A84C]',
        label: labels.returnCompleted,
      };
    case 'cancelled':
      return {
        bg: 'bg-[#2D1F1F]/5',
        text: 'text-[#2D1F1F]/55',
        label: labels.returnCancelled,
      };
  }
}
