import {
  deleteLaravelAddress,
  updateLaravelAddress,
} from '@/lib/api/server/account';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import {
  parseAddressIdParam,
  parseUpdateAddressBody,
} from '@/lib/account/validate';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type AddressContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: AddressContext) {
  const { id: rawId } = await context.params;
  const id = parseAddressIdParam(rawId);
  if (id === null) return invalidAccountInput();

  const body = await readAccountJsonBody(request);
  if (body === undefined) return invalidAccountInput();

  const input = parseUpdateAddressBody(body);
  if (!input) return invalidAccountInput();

  const result = await updateLaravelAddress(id, input);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, address: result.data }),
    result,
  );
}

export async function DELETE(_request: Request, context: AddressContext) {
  const { id: rawId } = await context.params;
  const id = parseAddressIdParam(rawId);
  if (id === null) return invalidAccountInput();

  const result = await deleteLaravelAddress(id);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(NextResponse.json({ ok: true }), result);
}
