import { isPositiveInt, isQuantity, parsePositiveIntString } from './ids';

const ADD_KEYS = new Set(['product_id', 'variant_id', 'quantity']);
const PATCH_KEYS = new Set(['quantity']);

export type AddCartItemInput = {
  productId: number;
  quantity: number;
  variantId?: number;
};

export type UpdateCartItemInput = {
  quantity: number;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function hasOnlyAllowedKeys(body: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(body).every(key => allowed.has(key));
}

export function parseAddCartItemBody(value: unknown): AddCartItemInput | null {
  const body = asObject(value);
  if (!body || !hasOnlyAllowedKeys(body, ADD_KEYS)) return null;
  if (!isPositiveInt(body.product_id) || !isQuantity(body.quantity)) return null;

  if (!('variant_id' in body) || body.variant_id === null) {
    return { productId: body.product_id, quantity: body.quantity };
  }
  if (!isPositiveInt(body.variant_id)) return null;

  return { productId: body.product_id, quantity: body.quantity, variantId: body.variant_id };
}

export function parseUpdateCartItemBody(value: unknown): UpdateCartItemInput | null {
  const body = asObject(value);
  if (!body || !hasOnlyAllowedKeys(body, PATCH_KEYS)) return null;
  if (!isQuantity(body.quantity)) return null;
  return { quantity: body.quantity };
}

/** The backend allows up to 99 of one bundle. */
export const BUNDLE_MAX_QUANTITY = 99;

function isBundleQuantity(value: unknown): value is number {
  return isPositiveInt(value) && value <= BUNDLE_MAX_QUANTITY;
}

export function parseAddCartBundleBody(
  value: unknown,
): { bundleId: number; quantity: number } | null {
  const body = asObject(value);
  if (!body || !hasOnlyAllowedKeys(body, new Set(['bundle_id', 'quantity']))) return null;
  if (!isPositiveInt(body.bundle_id) || !isBundleQuantity(body.quantity)) return null;
  return { bundleId: body.bundle_id, quantity: body.quantity };
}

export function parseUpdateCartBundleBody(value: unknown): { quantity: number } | null {
  const body = asObject(value);
  if (!body || !hasOnlyAllowedKeys(body, PATCH_KEYS)) return null;
  if (!isBundleQuantity(body.quantity)) return null;
  return { quantity: body.quantity };
}

export function parseCartItemParam(raw: string): number | null {
  return parsePositiveIntString(raw);
}
