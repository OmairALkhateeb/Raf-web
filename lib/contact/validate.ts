/**
 * Contact form rules, matching the backend's StoreContactMessageRequest
 * (`POST /public/contact`): every field required; name ≤ 120, email ≤ 190
 * (valid address), subject ≤ 190, message ≤ 5000.
 */
export const CONTACT_LIMITS = {
  name: 120,
  email: 190,
  subject: 190,
  message: 5000,
} as const;

export type ContactField = keyof typeof CONTACT_LIMITS;

export const CONTACT_FIELDS: readonly ContactField[] = [
  'name',
  'email',
  'subject',
  'message',
];

export type ContactFieldError = 'required' | 'too_long' | 'invalid_email';

export type ContactInput = Record<ContactField, string>;

export type ContactFieldErrors = Partial<Record<ContactField, ContactFieldError>>;

// Same shape Laravel's `email` rule accepts in practice; the backend has the
// final say.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(input: ContactInput): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  for (const field of CONTACT_FIELDS) {
    const value = input[field].trim();
    if (!value) errors[field] = 'required';
    else if (value.length > CONTACT_LIMITS[field]) errors[field] = 'too_long';
  }
  if (!errors.email && !EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'invalid_email';
  }
  return errors;
}

/** Untrusted input from the client → trimmed strings, or null if malformed. */
export function readContactInput(raw: unknown): ContactInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const out = {} as ContactInput;
  for (const field of CONTACT_FIELDS) {
    const value = record[field];
    if (typeof value !== 'string') return null;
    out[field] = value.trim();
  }
  return out;
}
