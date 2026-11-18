import { isPositiveInt, parsePositiveIntString } from '@/lib/cart/ids';

const ADD_KEYS = new Set(['product_id', 'variant_id']);

export type AddWishlistInput = {
  productId: number;
  variantId?: number;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function hasOnlyAllowedKeys(
  body: Record<string, unknown>,
  allowed: Set<string>,
): boolean {
  return Object.keys(body).every((key) => allowed.has(key));
}

export function parseAddWishlistBody(value: unknown): AddWishlistInput | null {
  const body = asObject(value);
  if (!body || !hasOnlyAllowedKeys(body, ADD_KEYS)) return null;
  if (!isPositiveInt(body.product_id)) return null;

  if (!('variant_id' in body) || body.variant_id === null) {
    return { productId: body.product_id };
  }
  if (!isPositiveInt(body.variant_id)) return null;
  return { productId: body.product_id, variantId: body.variant_id };
}

export function parseWishlistIdParam(raw: string): number | null {
  return parsePositiveIntString(raw);
}
