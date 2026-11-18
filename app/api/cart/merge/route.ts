import { mergeLaravelCart } from '@/lib/api/server/cart';
import { cartJsonResponse, readGuestTokenCookie } from '@/lib/api/server/cart-route';

export const dynamic = 'force-dynamic';

export async function POST() {
  const token = await readGuestTokenCookie();
  const result = await mergeLaravelCart(token);
  return cartJsonResponse(result);
}
