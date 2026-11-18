'use server';

import { ApiError, apiPost, isTransportFailure } from '@/lib/api/server/http';
import {
  CONTACT_FIELDS,
  readContactInput,
  validateContact,
  type ContactFieldErrors,
} from '@/lib/contact/validate';

export type ContactResult =
  | { status: 'success' }
  | { status: 'validation'; fields: ContactFieldErrors }
  | { status: 'rate_limited'; retryAfter?: number }
  | { status: 'error' };

/** Laravel 422 → which fields failed. The UI words the message itself. */
function fieldsFromLaravel(body: unknown): ContactFieldErrors {
  const fields: ContactFieldErrors = {};
  if (!body || typeof body !== 'object') return fields;
  const errors = (body as { errors?: unknown }).errors;
  if (!errors || typeof errors !== 'object') return fields;
  for (const field of CONTACT_FIELDS) {
    const messages = (errors as Record<string, unknown>)[field];
    if (!Array.isArray(messages) || typeof messages[0] !== 'string') continue;
    const message = messages[0].toLowerCase();
    fields[field] = message.includes('greater than')
      ? 'too_long'
      : field === 'email' && message.includes('valid')
        ? 'invalid_email'
        : 'required';
  }
  return fields;
}

/**
 * POST /api/public/contact — stores the message for the admin panel.
 * Success only on 201. The backend allows 5 messages per minute per IP (429).
 */
export async function sendContactMessage(raw: unknown): Promise<ContactResult> {
  const input = readContactInput(raw);
  if (!input) return { status: 'validation', fields: {} };

  const fields = validateContact(input);
  if (Object.keys(fields).length > 0) return { status: 'validation', fields };

  try {
    await apiPost<{ message: string }>('/public/contact', input);
    return { status: 'success' };
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      return { status: 'validation', fields: fieldsFromLaravel(error.body) };
    }
    if (error instanceof ApiError && error.status === 429) {
      return { status: 'rate_limited', retryAfter: error.retryAfter };
    }
    if (isTransportFailure(error)) {
      return { status: 'error' };
    }
    throw error;
  }
}
