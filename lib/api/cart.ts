import type { CartSnapshot } from '@/types';
import type { CartClientError, CartClientSuccess } from '@/types/api/cart';

export type CartClientResult = CartClientSuccess<CartSnapshot> | CartClientError;

async function parseResult(res: Response): Promise<CartClientResult> {
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, code: 'unavailable' };
  }

  if (
    json &&
    typeof json === 'object' &&
    'ok' in json &&
    (json as { ok: unknown }).ok === true &&
    'cart' in json
  ) {
    return json as CartClientSuccess<CartSnapshot>;
  }

  if (
    json &&
    typeof json === 'object' &&
    'ok' in json &&
    (json as { ok: unknown }).ok === false &&
    'code' in json &&
    typeof (json as { code: unknown }).code === 'string'
  ) {
    return json as CartClientError;
  }

  return { ok: false, code: 'unavailable' };
}

async function cartRequest(path: string, init?: RequestInit): Promise<CartClientResult> {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    return await parseResult(res);
  } catch {
    return { ok: false, code: 'unavailable' };
  }
}

export function getCart(): Promise<CartClientResult> {
  return cartRequest('/api/cart');
}

/** The cart priced for one address and shipping method (checkout totals). */
export function getCartQuote(addressId: number, shippingMethodId: number): Promise<CartClientResult> {
  const query = new URLSearchParams({
    address_id: String(addressId),
    shipping_method_id: String(shippingMethodId),
  });
  return cartRequest(`/api/cart?${query.toString()}`);
}

export function addCartItem(input: {
  productId: number;
  quantity: number;
  variantId?: number;
}): Promise<CartClientResult> {
  const body: Record<string, number> = {
    product_id: input.productId,
    quantity: input.quantity,
  };
  if (input.variantId !== undefined) body.variant_id = input.variantId;

  return cartRequest('/api/cart/items', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateCartItem(itemId: number, quantity: number): Promise<CartClientResult> {
  return cartRequest(`/api/cart/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(itemId: number): Promise<CartClientResult> {
  return cartRequest(`/api/cart/items/${itemId}`, { method: 'DELETE' });
}

export function addCartBundle(bundleId: number, quantity: number): Promise<CartClientResult> {
  return cartRequest('/api/cart/bundles', {
    method: 'POST',
    body: JSON.stringify({ bundle_id: bundleId, quantity }),
  });
}

export function updateCartBundle(bundleItemId: number, quantity: number): Promise<CartClientResult> {
  return cartRequest(`/api/cart/bundles/${bundleItemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartBundle(bundleItemId: number): Promise<CartClientResult> {
  return cartRequest(`/api/cart/bundles/${bundleItemId}`, { method: 'DELETE' });
}

export function mergeCart(): Promise<CartClientResult> {
  return cartRequest('/api/cart/merge', { method: 'POST' });
}
