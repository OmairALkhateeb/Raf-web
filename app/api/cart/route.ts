import { fetchLaravelCart } from '@/lib/api/server/cart';
import {
  cartJsonResponse,
  readGuestTokenCookie,
} from '@/lib/api/server/cart-route';

export const dynamic = 'force-dynamic';

function positiveId(value: string | null): number | undefined {
  if (!value || !/^\d{1,9}$/.test(value)) return undefined;
  const n = Number(value);
  return n > 0 ? n : undefined;
}

/** `?address_id=&shipping_method_id=` (both or neither): checkout's exact totals. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const addressId = positiveId(params.get('address_id'));
  const shippingMethodId = positiveId(params.get('shipping_method_id'));
  const token = await readGuestTokenCookie();
  const result = await fetchLaravelCart(
    token,
    addressId !== undefined && shippingMethodId !== undefined
      ? { addressId, shippingMethodId }
      : undefined,
  );

  return cartJsonResponse(result);
}