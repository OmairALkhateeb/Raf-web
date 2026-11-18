'use server';

import type { LaravelValidationError, NewsletterSubscribeSuccess } from '@/types/api/footer';
import { ApiError, apiPost, isTransportFailure } from '@/lib/api/server/http';

const MAX_EMAIL_LENGTH = 254;
const MAX_VALIDATION_MESSAGE_LENGTH = 200;

export type NewsletterResult =
  | { status: 'success' }
  | { status: 'validation'; message?: string }
  | { status: 'error' };

function sanitizeMessage(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, MAX_VALIDATION_MESSAGE_LENGTH);
}

function validationMessageFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;

  const payload = body as LaravelValidationError;
  const emailErrors = payload.errors?.email;
  if (Array.isArray(emailErrors) && typeof emailErrors[0] === 'string') {
    const message = sanitizeMessage(emailErrors[0]);
    if (message) return message;
  }

  if (typeof payload.message === 'string') {
    const message = sanitizeMessage(payload.message);
    if (message) return message;
  }

  return undefined;
}

/**
 * POST /api/public/newsletter/subscribe
 *
 * Arguments are untrusted runtime input. Missing API_BASE_URL and unknown
 * programming errors propagate; expected Laravel/network failures do not.
 */
export async function subscribeNewsletter(email: unknown): Promise<NewsletterResult> {
  if (typeof email !== 'string') {
    return { status: 'validation' };
  }

  const trimmed = email.trim();
  if (!trimmed || trimmed.length > MAX_EMAIL_LENGTH) {
    return { status: 'validation' };
  }

  try {
    await apiPost<NewsletterSubscribeSuccess>('/public/newsletter/subscribe', { email: trimmed });
    return { status: 'success' };
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      return { status: 'validation', message: validationMessageFromBody(error.body) };
    }
    if (isTransportFailure(error)) {
      return { status: 'error' };
    }
    throw error;
  }
}
