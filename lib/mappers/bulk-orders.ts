import 'server-only';

import type {
  AccountBulkOrderRequest,
  AccountBulkOrderRequestsMeta,
  AccountBulkOrderStatus,
} from '@/types';
import type { BulkOrderCreateFields } from '@/types/api/account';
import { firstValidationMessage } from '@/lib/mappers/auth';

const BULK_STATUSES: readonly AccountBulkOrderStatus[] = [
  'pending',
  'quoted',
  'accepted',
  'rejected',
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
  if (value === undefined) return null;
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

function isBulkStatus(value: unknown): value is AccountBulkOrderStatus {
  return (
    typeof value === 'string' &&
    (BULK_STATUSES as readonly string[]).includes(value)
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
 * Index eager-loads `product:id,name`. Create/accept may omit product_name.
 * Resource never returns product image, merchant name, variant label, or currency.
 */
export function parseLaravelBulkOrderRequest(
  raw: unknown,
): AccountBulkOrderRequest | undefined {
  const dto = asRecord(unwrapLaravelData(raw));
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const productId = positiveInt(dto.product_id);
  const quantity = positiveInt(dto.quantity);
  const createdAt = asNonEmptyString(dto.created_at);
  if (
    id === undefined ||
    productId === undefined ||
    quantity === undefined ||
    !createdAt ||
    !isBulkStatus(dto.status)
  ) {
    return undefined;
  }

  let variantId: number | null = null;
  if (dto.variant_id !== undefined && dto.variant_id !== null) {
    const v = positiveInt(dto.variant_id);
    if (v === undefined) return undefined;
    variantId = v;
  }

  const productName =
    dto.product_name === undefined
      ? null
      : asNullableString(dto.product_name);
  if (productName === undefined) return undefined;

  const customerName =
    dto.customer_name === undefined
      ? null
      : asNullableString(dto.customer_name);
  if (customerName === undefined) return undefined;

  const note = asNullableString(dto.note);
  if (note === undefined) return undefined;

  const quotedNote = asNullableString(dto.quoted_note);
  if (quotedNote === undefined) return undefined;

  const respondedAt = asNullableString(dto.responded_at);
  if (respondedAt === undefined) return undefined;

  let quotedUnitPrice: string | null = null;
  if (dto.quoted_unit_price !== undefined && dto.quoted_unit_price !== null) {
    if (typeof dto.quoted_unit_price === 'string') {
      const trimmed = dto.quoted_unit_price.trim();
      if (!trimmed) return undefined;
      quotedUnitPrice = trimmed;
    } else if (
      typeof dto.quoted_unit_price === 'number' &&
      Number.isFinite(dto.quoted_unit_price)
    ) {
      quotedUnitPrice = String(dto.quoted_unit_price);
    } else {
      return undefined;
    }
  }

  return {
    id,
    productId,
    productName,
    productNameAr: asNonEmptyString(dto.product_name_ar) ?? null,
    variantId,
    customerName,
    quantity,
    note,
    status: dto.status,
    quotedUnitPrice,
    quotedNote,
    respondedAt,
    createdAt,
  };
}

export function parseLaravelBulkOrderRequestsPage(
  raw: unknown,
):
  | {
      requests: AccountBulkOrderRequest[];
      meta: AccountBulkOrderRequestsMeta;
    }
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

  const requests: AccountBulkOrderRequest[] = [];
  for (const entry of data) {
    const row = parseLaravelBulkOrderRequest(entry);
    if (!row) {
      console.error('Laravel bulk-order-request row could not be mapped');
      continue;
    }
    requests.push(row);
  }

  return {
    requests,
    meta: { currentPage, lastPage, perPage, total },
  };
}

export function parseBulkOrderCreateFields(
  body: unknown,
): BulkOrderCreateFields {
  const record = asRecord(body);
  const errors = record ? asRecord(record.errors) : null;
  if (!errors) return {};

  const fields: BulkOrderCreateFields = {};
  for (const key of [
    'product_id',
    'variant_id',
    'quantity',
    'note',
    'bulk_order_request',
    'status',
  ] as const) {
    const messages = stringArray(errors[key]);
    if (messages[0]) fields[key] = messages[0];
  }
  return fields;
}

export function bulkOrderValidationMessage(body: unknown): string | undefined {
  const fields = parseBulkOrderCreateFields(body);
  const firstField = Object.values(fields).find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return firstField ?? firstValidationMessage(body);
}
