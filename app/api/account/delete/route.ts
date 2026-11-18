import { NextResponse } from 'next/server';
import type {
  DeleteAccountErrorCode,
  DeleteAccountErrorJson,
} from '@/types/api/account';
import {
  applyAuthCookies,
  clearAuthCookies,
} from '@/lib/api/server/auth-cookies';
import {
  readJsonBody,
  readStringField,
} from '@/lib/api/server/auth-route';
import {
  laravelCustomerFetch,
  withCustomerAuth,
  type CustomerAuthAttempt,
} from '@/lib/api/server/customer-auth';
import { laravelErrorCode } from '@/lib/api/server/error-code';
import { parseDeletionBlockers } from '@/lib/mappers/account-deletion';

/** The backend's limit for the optional "why are you leaving?" answer. */
const REASON_MAX_LENGTH = 500;

function applyAttemptCookies(
  response: NextResponse,
  attempt: CustomerAuthAttempt,
): NextResponse {
  if (attempt.clearAuth) {
    clearAuthCookies(response);
  } else if (attempt.rotatedTokens) {
    applyAuthCookies(
      response,
      attempt.rotatedTokens,
      attempt.remember,
    );
  }

  return response;
}

function failure(
  code: DeleteAccountErrorCode,
  status: number,
  blockers?: DeleteAccountErrorJson['blockers'],
): NextResponse {
  const body: DeleteAccountErrorJson = blockers
    ? { ok: false, code, blockers }
    : { ok: false, code };

  return NextResponse.json(body, { status });
}

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  return data as Record<string, unknown>;
}

function hasFieldError(data: unknown, field: string): boolean {
  const errors = asRecord(asRecord(data)?.errors);
  const messages = errors?.[field];

  return (
    Array.isArray(messages) &&
    messages.some((error) => typeof error === 'string')
  );
}

/** Trimmed, at most 500 characters; `undefined` when nothing was given. */
function readReason(body: unknown): string | undefined {
  const reason = readStringField(body, 'reason')?.trim();

  return reason ? reason.slice(0, REASON_MAX_LENGTH) : undefined;
}

export async function DELETE(request: Request) {
  const body = await readJsonBody(request);
  const currentPassword = readStringField(
    body,
    'current_password',
  );
  const reason = readReason(body);

  if (
    currentPassword === undefined ||
    currentPassword === ''
  ) {
    return failure('invalid_input', 400);
  }

  try {
    const attempt = await withCustomerAuth((accessToken) =>
      laravelCustomerFetch('/customer/account', {
        method: 'DELETE',
        accessToken,
        body: {
          current_password: currentPassword,
          ...(reason ? { reason } : {}),
        },
      }),
    );

    const result = attempt.result;

    if (result.unreachable) {
      return applyAttemptCookies(
        failure('unavailable', 503),
        attempt,
      );
    }

    if (result.status >= 200 && result.status < 300) {
      // Successful deletion must clear the session, even if
      // the access token was refreshed before the request.
      return clearAuthCookies(
        NextResponse.json({ ok: true }),
      );
    }

    if (result.status === 401) {
      return clearAuthCookies(
        failure('unauthenticated', 401),
      );
    }

    if (result.status === 422) {
      // An order, refund or return is still open. The controller answers
      // `account_deletion_blocked` with the list; the second check inside the
      // deletion (after unpaid orders are cancelled) answers a plain
      // validation error on `account`, without one.
      if (
        laravelErrorCode(result.data) === 'account_deletion_blocked' ||
        hasFieldError(result.data, 'account')
      ) {
        return applyAttemptCookies(
          failure(
            'blocked',
            422,
            parseDeletionBlockers(asRecord(result.data)?.blockers),
          ),
          attempt,
        );
      }

      return applyAttemptCookies(
        failure(
          hasFieldError(result.data, 'current_password')
            ? 'incorrect_password'
            : 'validation',
          422,
        ),
        attempt,
      );
    }

    if (result.status === 429) {
      // 5 tries a minute per account, wrong passwords included.
      return applyAttemptCookies(
        failure('too_many_attempts', 429),
        attempt,
      );
    }

    if (result.status === 403) {
      return applyAttemptCookies(
        failure('forbidden', 403),
        attempt,
      );
    }

    return applyAttemptCookies(
      failure('unavailable', 503),
      attempt,
    );
  } catch (error) {
    console.error(
      'Account deletion request failed',
      error instanceof Error ? error.name : 'unknown',
    );

    return failure('unavailable', 503);
  }
}
