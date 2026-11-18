import type {
  WishlistClientError,
  WishlistItemJson,
  WishlistItemResponseJson,
  WishlistListJson,
} from '@/types/api/wishlist';
import { isWishlistErrorCode } from '@/lib/wishlist/messages';
import type { AddWishlistInput } from '@/lib/wishlist/validate';

export type WishlistClientResult<T> =
  { ok: true; data: T } | WishlistClientError;

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    console.error('Wishlist client received a non-JSON response', res.status);
    return undefined;
  }
}

function asError(
  json: unknown,
  fallback: WishlistClientError['code'],
): WishlistClientError {
  if (
    json &&
    typeof json === 'object' &&
    'ok' in json &&
    (json as { ok: unknown }).ok === false
  ) {
    const code = 'code' in json ? (json as { code: unknown }).code : undefined;
    const error =
      'error' in json && typeof (json as { error: unknown }).error === 'string'
        ? (json as { error: string }).error
        : undefined;
    if (isWishlistErrorCode(code)) {
      return { ok: false, code, error };
    }
  }
  return { ok: false, code: fallback };
}

async function wishlistRequest(
  path: string,
  init?: RequestInit,
): Promise<{ res: Response; json: unknown } | WishlistClientError> {
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
    const json = await readJson(res);
    return { res, json };
  } catch (error) {
    console.error(
      'Wishlist client request failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, code: 'unavailable' };
  }
}

export async function fetchWishlist(): Promise<
  WishlistClientResult<WishlistItemJson[]>
> {
  const result = await wishlistRequest('/api/wishlist');
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as WishlistListJson | undefined;
  if (json && json.ok === true && Array.isArray(json.items)) {
    return { ok: true, data: json.items };
  }
  return { ok: false, code: 'unavailable' };
}

export async function addWishlistItem(
  input: AddWishlistInput,
): Promise<WishlistClientResult<WishlistItemJson>> {
  const body: Record<string, number | null> = {
    product_id: input.productId,
    variant_id: input.variantId ?? null,
  };
  const result = await wishlistRequest('/api/wishlist', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as WishlistItemResponseJson | undefined;
  if (json && json.ok === true && json.item) {
    return { ok: true, data: json.item };
  }
  return { ok: false, code: 'unavailable' };
}

export async function removeWishlistItem(
  id: number,
): Promise<WishlistClientResult<true>> {
  const result = await wishlistRequest(`/api/wishlist/${id}`, {
    method: 'DELETE',
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  if (
    result.json &&
    typeof result.json === 'object' &&
    'ok' in result.json &&
    (result.json as { ok: unknown }).ok === true
  ) {
    return { ok: true, data: true };
  }
  return { ok: false, code: 'unavailable' };
}
