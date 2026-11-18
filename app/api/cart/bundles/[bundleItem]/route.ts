import { removeLaravelCartBundle, updateLaravelCartBundle } from '@/lib/api/server/cart';
import { cartJsonResponse, invalidInputResponse, readGuestTokenCookie } from '@/lib/api/server/cart-route';
import { parseCartItemParam, parseUpdateCartBundleBody } from '@/lib/cart/validate';

export const dynamic = 'force-dynamic';

type BundleContext = { params: Promise<{ bundleItem: string }> };

export async function PATCH(request: Request, context: BundleContext) {
  const { bundleItem } = await context.params;
  const bundleItemId = parseCartItemParam(bundleItem);
  if (bundleItemId === null) return invalidInputResponse();

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return invalidInputResponse();
  }

  const input = parseUpdateCartBundleBody(json);
  if (!input) return invalidInputResponse();

  const token = await readGuestTokenCookie();
  const result = await updateLaravelCartBundle(bundleItemId, input.quantity, token);
  return cartJsonResponse(result);
}

export async function DELETE(_request: Request, context: BundleContext) {
  const { bundleItem } = await context.params;
  const bundleItemId = parseCartItemParam(bundleItem);
  if (bundleItemId === null) return invalidInputResponse();

  const token = await readGuestTokenCookie();
  const result = await removeLaravelCartBundle(bundleItemId, token);
  return cartJsonResponse(result);
}
