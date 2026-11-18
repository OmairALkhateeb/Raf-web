import { addLaravelCartItem } from '@/lib/api/server/cart';
import { cartJsonResponse, invalidInputResponse, readGuestTokenCookie } from '@/lib/api/server/cart-route';
import { parseAddCartItemBody } from '@/lib/cart/validate';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return invalidInputResponse();
  }

  const input = parseAddCartItemBody(json);
  if (!input) return invalidInputResponse();

  const token = await readGuestTokenCookie();
  const result = await addLaravelCartItem(input, token);
  return cartJsonResponse(result);
}
