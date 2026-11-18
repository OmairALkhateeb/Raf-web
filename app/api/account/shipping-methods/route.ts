import { getLaravelShippingMethods } from '@/lib/api/server/checkout';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
} from '@/lib/api/server/account-route';
import { parseAddressIdQuery } from '@/lib/account/checkout';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Delivery options and fees for one of the customer's addresses. */
export async function GET(request: Request) {
  const addressId = parseAddressIdQuery(
    new URL(request.url).searchParams.get('address_id'),
  );
  if (addressId === null) return invalidAccountInput();

  const result = await getLaravelShippingMethods(addressId);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, methods: result.data }),
    result,
  );
}
