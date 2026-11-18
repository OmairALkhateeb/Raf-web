import { removeLaravelWishlistItem } from '@/lib/api/server/wishlist';
import {
  applyWishlistCookies,
  invalidWishlistInput,
  wishlistErrorResponse,
} from '@/lib/api/server/wishlist-route';
import { parseWishlistIdParam } from '@/lib/wishlist/validate';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type WishlistContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: WishlistContext) {
  const { id: rawId } = await context.params;
  const id = parseWishlistIdParam(rawId);
  if (id === null) return invalidWishlistInput();

  const result = await removeLaravelWishlistItem(id);
  if (!result.ok) return wishlistErrorResponse(result);
  return applyWishlistCookies(NextResponse.json({ ok: true }), result);
}
