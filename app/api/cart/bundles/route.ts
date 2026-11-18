import { addLaravelCartBundle } from '@/lib/api/server/cart';
import { cartJsonResponse, invalidInputResponse, readGuestTokenCookie } from '@/lib/api/server/cart-route';
import { parseAddCartBundleBody } from '@/lib/cart/validate';

export const dynamic = 'force-dynamic';

/** Add a bundle (guests too, via the guest-token cookie). */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return invalidInputResponse();
  }

  const input = parseAddCartBundleBody(json);
  if (!input) return invalidInputResponse();

  const token = await readGuestTokenCookie();
  const result = await addLaravelCartBundle(input.bundleId, input.quantity, token);
  return cartJsonResponse(result);
}
