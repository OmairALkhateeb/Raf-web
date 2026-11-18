import 'server-only';

import type {
  AccountReturnOrderItem,
  AccountReturnReason,
  AccountReturnReasons,
  AccountReturnRequest,
  AccountReturnStatus,
  AccountReturnsMeta,
} from '@/types';
import type { ReturnCreateFields } from '@/types/api/account';
import { firstValidationMessage } from '@/lib/mappers/auth';
import { resolveMediaUrl } from '@/lib/api/server/media';
import type { AccountRefundStatus } from '@/types';

export function parseRefundStatus(value: unknown): AccountRefundStatus | null {
  return value === 'succeeded' ||
    value === 'failed' ||
    value === 'pending' ||
    value === 'awaiting_transfer'
    ? value
    : null;
}

const RETURN_STATUSES: readonly AccountReturnStatus[] = [
  'pending',
  'approved',
  'rejected',
  'completed',
  'cancelled',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function positiveInt(value: unknown): number | undefined {
  const n = finiteNumber(value);
  if (n === undefined || !Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function nonNegativeInt(value: unknown): number | undefined {
  const n = finiteNumber(value);
  if (n === undefined || !Number.isInteger(n) || n < 0) return undefined;
  return n;
}

function pageNumber(value: unknown): number | undefined {
  const n = nonNegativeInt(value);
  if (n === undefined) return undefined;
  return n < 1 ? 1 : n;
}

function unwrapLaravelData(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record) return payload;
  if ('data' in record) return record.data;
  return payload;
}

function isReturnStatus(value: unknown): value is AccountReturnStatus {
  return (
    typeof value === 'string' &&
    (RETURN_STATUSES as readonly string[]).includes(value)
  );
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string =>
      typeof entry === 'string' && entry.trim().length > 0,
  );
}

/**
 * ReturnRequestResource exposes `order_item.image_url` as the raw
 * `order_items.image_path` snapshot (not a Storage URL). That contract is
 * unreliable for next/image, so the storefront intentionally omits images.
 */
function parseReturnOrderItem(
  raw: unknown,
): AccountReturnOrderItem | null | undefined {
  if (raw === undefined) return null;
  if (raw === null) return null;
  const dto = asRecord(raw);
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const productName = asNonEmptyString(dto.product_name);
  const orderedQuantity = positiveInt(dto.ordered_quantity);
  if (id === undefined || !productName || orderedQuantity === undefined) {
    return undefined;
  }

  let productId: number | null = null;
  if (dto.product_id !== null && dto.product_id !== undefined) {
    const n = positiveInt(dto.product_id);
    if (n === undefined) return undefined;
    productId = n;
  }

  const sku = asNullableString(dto.sku);
  if (sku === undefined) return undefined;

  return {
    id,
    productId,
    productName,
    productNameAr: asNonEmptyString(dto.product_name_ar) ?? null,
    bundleName: asNonEmptyString(dto.bundle_name) ?? null,
    bundleNameAr: asNonEmptyString(dto.bundle_name_ar) ?? null,
    imageUrl:
      resolveMediaUrl(typeof dto.image_url === 'string' ? dto.image_url : null) ??
      null,
    sku,
    orderedQuantity,
  };
}

export function parseLaravelReturnRequest(
  raw: unknown,
): AccountReturnRequest | undefined {
  const dto = asRecord(unwrapLaravelData(raw));
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const subOrderId = positiveInt(dto.sub_order_id);
  const quantity = positiveInt(dto.quantity);
  const reason = asNonEmptyString(dto.reason);
  const createdAt = asNonEmptyString(dto.created_at);
  if (
    id === undefined ||
    subOrderId === undefined ||
    quantity === undefined ||
    !reason ||
    !createdAt ||
    !isReturnStatus(dto.status)
  ) {
    return undefined;
  }

  const note = asNullableString(dto.note);
  if (note === undefined) return undefined;

  const subOrderNumber =
    dto.sub_order_number === undefined
      ? null
      : asNullableString(dto.sub_order_number);
  if (subOrderNumber === undefined) return undefined;

  const orderItem = parseReturnOrderItem(dto.order_item);
  if (orderItem === undefined) return undefined;

  let refundAmount: number | null = null;
  if (dto.refund_amount !== null && dto.refund_amount !== undefined) {
    const n = finiteNumber(dto.refund_amount);
    if (n === undefined) return undefined;
    refundAmount = n;
  }

  const merchantNote = asNullableString(dto.merchant_note);
  if (merchantNote === undefined) return undefined;

  const resolvedAt = asNullableString(dto.resolved_at);
  const completedAt = asNullableString(dto.completed_at);
  if (resolvedAt === undefined || completedAt === undefined) return undefined;

  return {
    id,
    subOrderId,
    subOrderNumber,
    orderItem,
    quantity,
    reason,
    reasonLabel: asNonEmptyString(dto.reason_label) ?? reason,
    reasonLabelAr: asNonEmptyString(dto.reason_label_ar) ?? null,
    note,
    status: dto.status,
    refundAmount,
    refundStatus: parseRefundStatus(dto.refund_status),
    merchantNote,
    resolvedAt,
    completedAt,
    createdAt,
  };
}

export function parseLaravelReturnsPage(
  raw: unknown,
):
  | { returns: AccountReturnRequest[]; meta: AccountReturnsMeta }
  | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;

  const data = Array.isArray(record.data)
    ? record.data
    : unwrapLaravelData(raw);
  if (!Array.isArray(data)) return undefined;

  const metaRaw = asRecord(record.meta);
  const currentPage = metaRaw ? pageNumber(metaRaw.current_page) : undefined;
  const lastPage = metaRaw ? pageNumber(metaRaw.last_page) : undefined;
  const perPage = metaRaw ? positiveInt(metaRaw.per_page) : undefined;
  const total = metaRaw ? nonNegativeInt(metaRaw.total) : undefined;
  if (
    currentPage === undefined ||
    lastPage === undefined ||
    perPage === undefined ||
    total === undefined
  ) {
    return undefined;
  }

  const returns: AccountReturnRequest[] = [];
  for (const entry of data) {
    const row = parseLaravelReturnRequest(entry);
    if (!row) {
      console.error('Laravel return request row could not be mapped');
      continue;
    }
    returns.push(row);
  }

  return {
    returns,
    meta: { currentPage, lastPage, perPage, total },
  };
}

/** GET /customer/returns/reasons → `{ reasons: [...], return_window_days }`. */
export function parseLaravelReturnReasons(
  raw: unknown,
): AccountReturnReasons | undefined {
  const record = asRecord(raw);
  if (!record || !Array.isArray(record.reasons)) return undefined;

  const returnWindowDays = nonNegativeInt(record.return_window_days);
  if (returnWindowDays === undefined) return undefined;

  const reasons: AccountReturnReason[] = [];
  for (const entry of record.reasons) {
    const dto = asRecord(entry);
    const code = dto ? asNonEmptyString(dto.code) : undefined;
    const label = dto ? asNonEmptyString(dto.label) : undefined;
    if (!dto || !code || !label) {
      console.error('Laravel return reason could not be mapped');
      continue;
    }
    reasons.push({
      code,
      label,
      labelAr: asNonEmptyString(dto.label_ar) ?? null,
      requiresNote: dto.requires_note === true,
    });
  }
  if (reasons.length === 0) return undefined;

  return { reasons, returnWindowDays };
}

export function parseReturnCreateFields(body: unknown): ReturnCreateFields {
  const record = asRecord(body);
  const errors = record ? asRecord(record.errors) : null;
  if (!errors) return {};

  const fields: ReturnCreateFields = {};
  const keys: Array<keyof ReturnCreateFields> = [
    'order_item_id',
    'quantity',
    'reason',
    'note',
    'return_request',
    'status',
    'refund_iban',
    'refund_account_name',
  ];
  for (const key of keys) {
    const messages = stringArray(errors[key]);
    if (messages[0]) fields[key] = messages[0];
  }
  return fields;
}

export function returnValidationMessage(body: unknown): string | undefined {
  const fields = parseReturnCreateFields(body);
  const firstField = Object.values(fields).find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return firstField ?? firstValidationMessage(body);
}
