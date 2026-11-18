import 'server-only';

import type { RefundBankAccount } from '@/types';
import type { AccountClientError, RefundAccountFields } from '@/types/api/account';
import { firstValidationMessage } from '@/lib/mappers/auth';
import type { RefundAccountInput } from '@/lib/account/refund-account';
import type { AccountOpResult } from './account';
import { laravelCustomerFetch, withCustomerAuth } from './customer-auth';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * UserResource → only the two bank fields; the rest of the profile stays out
 * of this route. `undefined` = not a profile.
 */
function parseRefundAccount(payload: unknown): RefundBankAccount | null | undefined {
  const root = asRecord(payload);
  const user = asRecord(root && 'data' in root ? root.data : root);
  if (!user || typeof user.id !== 'number') return undefined;
  const iban = nonEmpty(user.refund_iban);
  if (!iban) return null;
  return { iban, accountName: nonEmpty(user.refund_account_name) ?? '' };
}

/** The backend's messages for the two fields, in the store's language. */
function parseRefundAccountFields(body: unknown): RefundAccountFields {
  const errors = asRecord(asRecord(body)?.errors);
  const fields: RefundAccountFields = {};
  for (const key of ['refund_iban', 'refund_account_name'] as const) {
    const messages = errors?.[key];
    const first = Array.isArray(messages) ? nonEmpty(messages[0]) : null;
    if (first) fields[key] = first;
  }
  return fields;
}

async function refundAccountRequest(
  init: { method: 'GET' } | { method: 'PATCH'; body: Record<string, unknown> },
): Promise<AccountOpResult<RefundBankAccount | null>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/profile', { ...init, accessToken }),
  );
  const cookies = {
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
  const fail = (error: AccountClientError): AccountOpResult<RefundBankAccount | null> => ({
    ok: false,
    error,
    ...cookies,
  });

  const { result } = attempt;
  if (result.unreachable) return fail({ ok: false, code: 'unavailable' });
  if (result.status === 401) return fail({ ok: false, code: 'unauthenticated' });
  if (result.status === 429) return fail({ ok: false, code: 'rate_limited' });
  if (result.status === 422) {
    return fail({
      ok: false,
      code: 'validation',
      error: firstValidationMessage(result.data),
      fields: parseRefundAccountFields(result.data),
    });
  }
  if (result.status !== 200) return fail({ ok: false, code: 'unavailable' });

  const account = parseRefundAccount(result.data);
  if (account === undefined) {
    console.error('Laravel profile payload has no refund account fields');
    return fail({ ok: false, code: 'unavailable' });
  }
  return { ok: true, data: account, ...cookies };
}

/** GET /customer/profile → the saved bank account, or `null`. */
export function getLaravelRefundAccount() {
  return refundAccountRequest({ method: 'GET' });
}

/**
 * PATCH /customer/profile with only `refund_iban` + `refund_account_name`
 * (both `null` removes the account). Answers what the backend saved.
 */
export function saveLaravelRefundAccount(input: RefundAccountInput | null) {
  return refundAccountRequest({
    method: 'PATCH',
    body: {
      refund_iban: input ? input.iban : null,
      refund_account_name: input ? input.accountName : null,
    },
  });
}
