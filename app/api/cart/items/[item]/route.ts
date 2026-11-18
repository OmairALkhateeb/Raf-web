import { removeLaravelCartItem, updateLaravelCartItem } from '@/lib/api/server/cart';
import { cartJsonResponse, invalidInputResponse, readGuestTokenCookie } from '@/lib/api/server/cart-route';
import { parseCartItemParam, parseUpdateCartItemBody } from '@/lib/cart/validate';

export const dynamic = 'force-dynamic';

type ItemContext = { params: Promise<{ item: string }> };

export async function PATCH(request: Request, context: ItemContext) {
  const { item } = await context.params;
  const itemId = parseCartItemParam(item);
  if (itemId === null) return invalidInputResponse();

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return invalidInputResponse();
  }

  const input = parseUpdateCartItemBody(json);
  if (!input) return invalidInputResponse();

  const token = await readGuestTokenCookie();
  const result = await updateLaravelCartItem(itemId, input.quantity, token);
  return cartJsonResponse(result);
}

export async function DELETE(_request: Request, context: ItemContext) {
  const { item } = await context.params;
  const itemId = parseCartItemParam(item);
  if (itemId === null) return invalidInputResponse();

  const token = await readGuestTokenCookie();
  const result = await removeLaravelCartItem(itemId, token);
  return cartJsonResponse(result);
}
