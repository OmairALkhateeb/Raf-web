import 'server-only';

import type {
  AccountReview,
  AccountReviewStatus,
  AccountReviewsMeta,
} from '@/types';
import type { ReviewCreateFields } from '@/types/api/account';
import { firstValidationMessage } from '@/lib/mappers/auth';
import { PLACEHOLDER_MEDIA } from '@/lib/mappers/product';
import { resolveMediaUrl } from '@/lib/api/server/media';

const REVIEW_STATUSES: readonly AccountReviewStatus[] = [
  'pending',
  'approved',
  'rejected',
  'hidden',
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

function isReviewStatus(value: unknown): value is AccountReviewStatus {
  return (
    typeof value === 'string' &&
    (REVIEW_STATUSES as readonly string[]).includes(value)
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
 * Customer GET/POST does not eager-load `product`/`customer`, so
 * `product_name`, `product_image`, and `customer_name` are often omitted.
 * Map only what Laravel returns; use placeholder media when image is absent.
 */
export function parseLaravelReview(raw: unknown): AccountReview | undefined {
  const dto = asRecord(unwrapLaravelData(raw));
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const productId = positiveInt(dto.product_id);
  const rating = finiteNumber(dto.rating);
  const createdAt = asNonEmptyString(dto.created_at);
  if (
    id === undefined ||
    productId === undefined ||
    rating === undefined ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    !createdAt ||
    !isReviewStatus(dto.status)
  ) {
    return undefined;
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

  const comment = asNullableString(dto.comment);
  if (comment === undefined) return undefined;

  const merchantReply = asNullableString(dto.merchant_reply);
  if (merchantReply === undefined) return undefined;

  const merchantRepliedAt = asNullableString(dto.merchant_replied_at);
  if (merchantRepliedAt === undefined) return undefined;

  let productImageUrl = PLACEHOLDER_MEDIA;
  if (dto.product_image !== undefined && dto.product_image !== null) {
    const resolved = resolveMediaUrl(
      typeof dto.product_image === 'string' ? dto.product_image : null,
    );
    if (resolved) productImageUrl = resolved;
  }

  const verifiedPurchase =
    dto.verified_purchase === undefined
      ? false
      : dto.verified_purchase === true;

  return {
    id,
    productId,
    productName,
    productNameAr: asNonEmptyString(dto.product_name_ar) ?? null,
    productSlug: asNonEmptyString(dto.product_slug) ?? null,
    productImageUrl,
    customerName,
    rating,
    comment,
    status: dto.status,
    merchantReply,
    merchantRepliedAt,
    verifiedPurchase,
    createdAt,
  };
}

export function parseLaravelReviewsPage(
  raw: unknown,
): { reviews: AccountReview[]; meta: AccountReviewsMeta } | undefined {
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

  const reviews: AccountReview[] = [];
  for (const entry of data) {
    const row = parseLaravelReview(entry);
    if (!row) {
      console.error('Laravel review row could not be mapped');
      continue;
    }
    reviews.push(row);
  }

  return {
    reviews,
    meta: { currentPage, lastPage, perPage, total },
  };
}

export function parseReviewCreateFields(body: unknown): ReviewCreateFields {
  const record = asRecord(body);
  const errors = record ? asRecord(record.errors) : null;
  if (!errors) return {};

  const fields: ReviewCreateFields = {};
  for (const key of ['order_item_id', 'rating', 'comment'] as const) {
    const messages = stringArray(errors[key]);
    if (messages[0]) fields[key] = messages[0];
  }
  return fields;
}

export function reviewValidationMessage(body: unknown): string | undefined {
  const fields = parseReviewCreateFields(body);
  const firstField = Object.values(fields).find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return firstField ?? firstValidationMessage(body);
}
