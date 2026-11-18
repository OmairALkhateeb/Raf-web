import { parsePositiveIntString } from '@/lib/cart/ids';
import type { AccountReviewStatus } from '@/types';

export type ReviewCreateInput = {
  orderItemId: number;
  rating: number;
  comment: string | null;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function readOptionalComment(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 2000) return undefined;
  return trimmed ? trimmed : null;
}

export function parseOrderItemIdParam(raw: string | null): number | null {
  if (!raw) return null;
  return parsePositiveIntString(raw);
}

/**
 * Accepts camelCase from the storefront client or snake_case.
 */
export function parseReviewCreateBody(body: unknown): ReviewCreateInput | null {
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

  const ratingRaw = record.rating;
  const ratingNum =
    typeof ratingRaw === 'number'
      ? ratingRaw
      : typeof ratingRaw === 'string'
        ? Number(ratingRaw)
        : NaN;
  if (
    !Number.isInteger(ratingNum) ||
    ratingNum < 1 ||
    ratingNum > 5
  ) {
    return null;
  }

  const comment = readOptionalComment(record.comment);
  if (comment === undefined) return null;

  return { orderItemId, rating: ratingNum, comment };
}

/** PATCH body: rating 1–5 and an optional comment. */
export function parseReviewUpdateBody(body: unknown): { rating: number; comment: string | null } | null {
  const record = asObject(body);
  if (!record) return null;
  const ratingNum =
    typeof record.rating === 'number'
      ? record.rating
      : typeof record.rating === 'string'
        ? Number(record.rating)
        : NaN;
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) return null;
  const comment = readOptionalComment(record.comment);
  if (comment === undefined) return null;
  return { rating: ratingNum, comment };
}

type ReviewStatusLabels = {
  reviewPending: string;
  reviewApproved: string;
  reviewRejected: string;
  reviewHidden: string;
};

export function reviewStatusPresentation(
  status: AccountReviewStatus,
  labels: ReviewStatusLabels,
): { bg: string; text: string; label: string } {
  switch (status) {
    case 'pending':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        label: labels.reviewPending,
      };
    case 'approved':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        label: labels.reviewApproved,
      };
    case 'rejected':
      return {
        bg: 'bg-red-50',
        text: 'text-red-600',
        label: labels.reviewRejected,
      };
    case 'hidden':
      return {
        bg: 'bg-[#2D1F1F]/5',
        text: 'text-[#2D1F1F]/55',
        label: labels.reviewHidden,
      };
  }
}
