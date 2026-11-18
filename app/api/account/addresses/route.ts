import {
  createLaravelAddress,
  listLaravelAddresses,
} from '@/lib/api/server/account';
import {
  accountErrorResponse,
  applyAccountCookies,
  invalidAccountInput,
  readAccountJsonBody,
} from '@/lib/api/server/account-route';
import { parseCreateAddressBody } from '@/lib/account/validate';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await listLaravelAddresses();
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, addresses: result.data }),
    result,
  );
}

export async function POST(request: Request) {
  const body = await readAccountJsonBody(request);
  if (body === undefined) return invalidAccountInput();

  const input = parseCreateAddressBody(body);
  if (!input) return invalidAccountInput();

  const result = await createLaravelAddress(input);
  if (!result.ok) return accountErrorResponse(result);
  return applyAccountCookies(
    NextResponse.json({ ok: true, address: result.data }, { status: 201 }),
    result,
  );
}
