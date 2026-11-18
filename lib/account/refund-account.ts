/**
 * The bank account RAF sends refunds to when it can't put them back on the
 * card (guide §5.5, §9.2). The backend has the final say: it removes spaces,
 * upper-cases and checks the IBAN checksum, and answers its own message.
 */
export type RefundAccountInput = {
  /** As typed; spaces are fine. */
  iban: string;
  accountName: string;
};

export type RefundAccountFieldCode = 'required' | 'invalid' | 'too_long';

export type RefundAccountFieldCodes = Partial<
  Record<'refund_iban' | 'refund_account_name', RefundAccountFieldCode>
>;

export const REFUND_ACCOUNT_NAME_MAX = 255;
/** 34 characters plus the spaces people type between groups. */
export const REFUND_IBAN_INPUT_MAX = 42;
export const REFUND_IBAN_PLACEHOLDER = 'OM81 0180 0000 0129 9123 456';

/** The page anchor notifications and "Add your bank account" links open. */
export const REFUND_ACCOUNT_ANCHOR = 'refund-bank-account';
export const REFUND_ACCOUNT_HREF = `/account/profile#${REFUND_ACCOUNT_ANCHOR}`;

// The backend's shape rule (App\Rules\Iban) without the checksum: 2 letters,
// 2 digits, then 11–30 letters or digits (15–34 in all).
const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

/** Spaces out, upper case: what the backend stores. */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

/** `OM810180000001299123456` → `OM81 0180 0000 0129 9123 456`. */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})(?=.)/g, '$1 ');
}

/** `OM81 •••• •••• 3456`: enough to recognise it, not to copy it. */
export function maskIban(iban: string): string {
  const value = normalizeIban(iban);
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)} •••• •••• ${value.slice(-4)}`;
}

/** Browser-side check before sending; the checksum is left to the backend. */
export function validateRefundAccount(input: RefundAccountInput): RefundAccountFieldCodes {
  const fields: RefundAccountFieldCodes = {};
  const iban = normalizeIban(input.iban);
  if (!iban) fields.refund_iban = 'required';
  else if (!IBAN_SHAPE.test(iban)) fields.refund_iban = 'invalid';
  const name = input.accountName.trim();
  if (!name) fields.refund_account_name = 'required';
  else if (name.length > REFUND_ACCOUNT_NAME_MAX) fields.refund_account_name = 'too_long';
  return fields;
}

/** Untrusted JSON from the client → both fields, trimmed; `null` if malformed. */
export function readRefundAccountBody(body: unknown): RefundAccountInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  if (typeof record.iban !== 'string' || typeof record.accountName !== 'string') return null;
  const iban = normalizeIban(record.iban);
  const accountName = record.accountName.trim();
  if (!iban || iban.length > 64 || !accountName || accountName.length > REFUND_ACCOUNT_NAME_MAX) {
    return null;
  }
  return { iban, accountName };
}
