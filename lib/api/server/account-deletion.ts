import 'server-only';

import type { AccountDeletionCheck } from '@/types';
import type { AccountClientError } from '@/types/api/account';
import { parseDeletionCheck } from '@/lib/mappers/account-deletion';
import type { AccountOpResult } from './account';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';

/**
 * GET /customer/account/deletion-check: what stops this account from being
 * deleted right now (open orders, refunds, returns) and how many unpaid
 * orders would be cancelled. Asked before the password.
 */
export async function getLaravelDeletionCheck(): Promise<AccountOpResult<AccountDeletionCheck>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/account/deletion-check', { method: 'GET', accessToken }),
  );
  const cookies = {
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
  const fail = (error: AccountClientError): AccountOpResult<AccountDeletionCheck> => ({
    ok: false,
    error,
    ...cookies,
  });

  const { result } = attempt;
  if (result.unreachable) return fail({ ok: false, code: 'unavailable' });
  if (result.status === 401) return fail({ ok: false, code: 'unauthenticated' });
  if (result.status === 403) return fail({ ok: false, code: 'forbidden' });
  if (result.status === 429) return fail({ ok: false, code: 'rate_limited' });
  if (result.status !== 200) return fail({ ok: false, code: 'unavailable' });

  const check = parseDeletionCheck(result.data);
  if (!check) {
    console.error('Laravel deletion-check payload is not a check');
    return fail({ ok: false, code: 'unavailable' });
  }
  return { ok: true, data: check, ...cookies };
}
