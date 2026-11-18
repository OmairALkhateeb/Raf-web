/**
 * Checkout body validation (BFF + client).
 * Mirrors Laravel CheckoutRequest: address_id, shipping_method_id,
 * optional coupon_code (max 50), idempotency_key (required, max 100).
 */

export type CheckoutCreateInput = {
  addressId: number;
  /** One of the ids from GET /customer/shipping-methods; never invent in source. */
  shippingMethodId: number;
  couponCode: string | null;
  idempotencyKey: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function positiveInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number.parseInt(value, 10);
    return n > 0 ? n : null;
  }
  return null;
}

function readOptionalCoupon(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length > 50) return undefined;
  return trimmed ? trimmed : null;
}

function readIdempotencyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 100) return null;
  return trimmed;
}

/**
 * Accepts only the four supported checkout fields (camelCase or snake_case).
 * Extra keys (prices, payment, notes, address objects) are ignored and never
 * forwarded — callers must send only the mapped Laravel body.
 */
export function parseCheckoutCreateBody(
  body: unknown,
): CheckoutCreateInput | null {
  const record = asObject(body);
  if (!record) return null;

  const addressRaw =
    record.addressId !== undefined ? record.addressId : record.address_id;
  const addressId = positiveInt(addressRaw);
  if (addressId === null) return null;

  const shippingRaw =
    record.shippingMethodId !== undefined
      ? record.shippingMethodId
      : record.shipping_method_id;
  const shippingMethodId = positiveInt(shippingRaw);
  if (shippingMethodId === null) return null;

  const couponRaw =
    record.couponCode !== undefined ? record.couponCode : record.coupon_code;
  const couponCode = readOptionalCoupon(couponRaw);
  if (couponCode === undefined) return null;

  const keyRaw =
    record.idempotencyKey !== undefined
      ? record.idempotencyKey
      : record.idempotency_key;
  const idempotencyKey = readIdempotencyKey(keyRaw);
  if (idempotencyKey === null) return null;

  return { addressId, shippingMethodId, couponCode, idempotencyKey };
}

/** Coupon preview body: code required; address and method optional. */
export function parseCouponPreviewBody(body: unknown): {
  couponCode: string;
  addressId: number | null;
  shippingMethodId: number | null;
} | null {
  const record = asObject(body);
  if (!record) return null;
  const couponCode = readOptionalCoupon(record.couponCode);
  if (!couponCode) return null;
  const addressId =
    record.addressId === undefined || record.addressId === null
      ? null
      : positiveInt(record.addressId);
  const shippingMethodId =
    record.shippingMethodId === undefined || record.shippingMethodId === null
      ? null
      : positiveInt(record.shippingMethodId);
  if (
    (record.addressId != null && addressId === null) ||
    (record.shippingMethodId != null && shippingMethodId === null)
  ) {
    return null;
  }
  return { couponCode, addressId, shippingMethodId };
}

export function parseAddressIdQuery(raw: string | null): number | null {
  return raw ? positiveInt(raw) : null;
}

export function toLaravelCheckoutBody(
  input: CheckoutCreateInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    address_id: input.addressId,
    shipping_method_id: input.shippingMethodId,
    idempotency_key: input.idempotencyKey,
  };
  if (input.couponCode) {
    body.coupon_code = input.couponCode;
  }
  return body;
}
