import type {
  AccountErrorCode,
  AccountClientError,
  AccountErrorReason,
} from '@/types/api/account';
import type { Dictionary } from '@/utils/translations';

export function localizeAccountError(
  error: AccountClientError,
  t: Dictionary,
): string {
  switch (error.code) {
    case 'unauthenticated':
      return t.common.pleaseSignIn;
    case 'unavailable':
      return t.common.serviceUnavailable;
    case 'rate_limited':
      return t.common.tooManyAttempts;
    case 'not_found':
      return t.errors.addressNotFound;
    case 'forbidden':
      return t.errors.addressForbidden;
    case 'invalid_input':
    case 'validation':
      return t.errors.addressInvalid;
    default:
      return t.common.serviceUnavailable;
  }
}

export function localizeOrderDetailError(
  error: AccountClientError,
  t: Dictionary,
): string {
  switch (error.code) {
    case 'not_found':
      return t.account.orderNotFound;
    case 'forbidden':
      return t.account.orderForbidden;
    default:
      return localizeAccountError(error, t);
  }
}

export function localizeReturnError(
  error: AccountClientError,
  t: Dictionary,
): string {
  switch (error.code) {
    case 'not_found':
      return t.errors.returnNotFound;
    case 'forbidden':
      return t.errors.returnForbidden;
    case 'validation':
    case 'invalid_input':
      return t.common.checkDetails;
    default:
      return localizeAccountError(error, t);
  }
}

export function localizeReviewError(
  error: AccountClientError,
  t: Dictionary,
): string {
  return localizeAccountError(error, t);
}

export function localizeProductQuestionError(
  error: AccountClientError,
  t: Dictionary,
): string {
  return localizeAccountError(error, t);
}

export function localizeBulkOrderError(
  error: AccountClientError,
  t: Dictionary,
): string {
  return localizeAccountError(error, t);
}

export function isAccountErrorCode(value: unknown): value is AccountErrorCode {
  return (
    value === 'invalid_input' ||
    value === 'validation' ||
    value === 'not_found' ||
    value === 'forbidden' ||
    value === 'unavailable' ||
    value === 'unauthenticated' ||
    value === 'rate_limited'
  );
}

// Every reason the store's routes can send. A Record, so a reason added to
// `AccountErrorReason` can't be left out here (it would be dropped silently).
const ACCOUNT_ERROR_REASONS: Record<AccountErrorReason, true> = {
  provider_unavailable: true,
  payment_not_found: true,
  payment_closed: true,
  key_used: true,
  cart_empty: true,
  cart_items: true,
  coupon: true,
  not_cancellable: true,
  address_not_deliverable: true,
  shipping_method_unavailable: true,
};

export function isAccountErrorReason(value: unknown): value is AccountErrorReason {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(ACCOUNT_ERROR_REASONS, value)
  );
}

/** Text for a failed confirm/retry payment ("Check again", "Try again"). */
export function localizePaymentError(
  error: AccountClientError,
  t: Dictionary,
): string {
  if (error.code === 'rate_limited') return t.common.tooManyAttempts;
  switch (error.reason) {
    case 'provider_unavailable':
      return t.checkout.paymentServiceUnavailable;
    case 'payment_closed':
      return t.checkout.paymentClosed;
    case 'payment_not_found':
      return t.checkout.paymentNotFound;
    case 'not_cancellable':
      return t.checkout.cancelNotPossible;
  }
  if (error.code === 'not_found' || error.code === 'forbidden') {
    return localizeOrderDetailError(error, t);
  }
  return error.code === 'unauthenticated' ? t.common.pleaseSignIn : t.common.serviceUnavailable;
}
