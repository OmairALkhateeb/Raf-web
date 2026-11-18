import {
  addLaravelWishlistItem,
  listLaravelWishlist,
} from '@/lib/api/server/wishlist';
import {
  applyWishlistCookies,
  invalidWishlistInput,
  readWishlistJsonBody,
  wishlistErrorResponse,
} from '@/lib/api/server/wishlist-route';
import { parseAddWishlistBody } from '@/lib/wishlist/validate';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await listLaravelWishlist();
  if (!result.ok) return wishlistErrorResponse(result);
  return applyWishlistCookies(
    NextResponse.json({ ok: true, items: result.data }),
    result,
  );
}

export async function POST(request: Request) {
  const body = await readWishlistJsonBody(request);
  if (body === undefined) return invalidWishlistInput();

  const input = parseAddWishlistBody(body);
  if (!input) return invalidWishlistInput();

  const result = await addLaravelWishlistItem(input);
  if (!result.ok) return wishlistErrorResponse(result);
  return applyWishlistCookies(
    NextResponse.json({ ok: true, item: result.data }),
    result,
  );
}
