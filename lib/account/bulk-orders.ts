import { parsePositiveIntString } from '@/lib/cart/ids';
import type {
  AccountBulkOrderRequest,
  AccountBulkOrderStatus,
} from '@/types';

export type BulkOrderCreateInput = {
  productId: number;
  variantId: number | null;
  quantity: number;
  note: string | null;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function readOptionalNote(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 2000) return undefined;
  return trimmed ? trimmed : null;
}

/**
 * Mirrors StoreBulkOrderRequestRequest:
 * product_id required, variant_id nullable, quantity required min 1, note max 2000.
 */
export function parseBulkOrderCreateBody(
  body: unknown,
): BulkOrderCreateInput | null {
  const record = asObject(body);
  if (!record) return null;

  const productRaw =
    record.productId !== undefined ? record.productId : record.product_id;
  const productId =
    typeof productRaw === 'number'
      ? Number.isInteger(productRaw) && productRaw > 0
        ? productRaw
        : null
      : typeof productRaw === 'string'
        ? parsePositiveIntString(productRaw)
        : null;
  if (productId === null) return null;

  const variantRaw =
    record.variantId !== undefined ? record.variantId : record.variant_id;
  let variantId: number | null = null;
  if (variantRaw !== undefined && variantRaw !== null && variantRaw !== '') {
    const parsed =
      typeof variantRaw === 'number'
        ? Number.isInteger(variantRaw) && variantRaw > 0
          ? variantRaw
          : null
        : typeof variantRaw === 'string'
          ? parsePositiveIntString(variantRaw)
          : null;
    if (parsed === null) return null;
    variantId = parsed;
  }

  const quantityRaw = record.quantity;
  const quantityNum =
    typeof quantityRaw === 'number'
      ? quantityRaw
      : typeof quantityRaw === 'string'
        ? Number(quantityRaw)
        : NaN;
  if (!Number.isInteger(quantityNum) || quantityNum < 1) return null;

  const note = readOptionalNote(record.note);
  if (note === undefined) return null;

  return { productId, variantId, quantity: quantityNum, note };
}

export function parseBulkOrderIdParam(raw: string | null | undefined): number | null {
  if (!raw) return null;
  return parsePositiveIntString(raw);
}

export function parseProductIdParam(raw: string | null): number | null {
  if (!raw) return null;
  return parsePositiveIntString(raw);
}

type BulkStatusLabels = {
  bulkPending: string;
  bulkQuoted: string;
  bulkAccepted: string;
  bulkRejected: string;
  bulkCancelled: string;
};

export function bulkOrderStatusPresentation(
  status: AccountBulkOrderStatus,
  labels: BulkStatusLabels,
): { bg: string; text: string; label: string } {
  switch (status) {
    case 'pending':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        label: labels.bulkPending,
      };
    case 'quoted':
      return {
        bg: 'bg-sky-50',
        text: 'text-sky-700',
        label: labels.bulkQuoted,
      };
    case 'accepted':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        label: labels.bulkAccepted,
      };
    case 'rejected':
      return {
        bg: 'bg-red-50',
        text: 'text-red-600',
        label: labels.bulkRejected,
      };
    case 'cancelled':
      return {
        bg: 'bg-[#2D1F1F]/5',
        text: 'text-[#2D1F1F]/55',
        label: labels.bulkCancelled,
      };
  }
}

/** Backend allows accept only when status === quoted. */
export function canAcceptBulkOrder(row: AccountBulkOrderRequest): boolean {
  return row.status === 'quoted' && row.quotedUnitPrice !== null;
}

/** Backend allows cancel when pending or quoted. */
export function canCancelBulkOrder(row: AccountBulkOrderRequest): boolean {
  return row.status === 'pending' || row.status === 'quoted';
}

export const BULK_ORDERS_CHANGED_EVENT = 'raf:bulk-orders-changed';

export function notifyBulkOrdersChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BULK_ORDERS_CHANGED_EVENT));
}
