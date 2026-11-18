import type {
  AccountBulkOrderRequest,
  AccountBulkOrderRequestsMeta,
  AccountOrder,
  AccountOrderDetail,
  AccountOrdersMeta,
  AccountProductQuestion,
  AccountProductQuestionsMeta,
  AccountReturnReasons,
  AccountReturnRequest,
  AccountReturnsMeta,
  AccountReview,
  AccountReviewsMeta,
  Address,
  CouponPreview,
  RefundBankAccount,
  ShippingMethodOption,
} from '@/types';
import type {
  AccountAddressJson,
  AccountAddressesJson,
  AccountBulkOrderRequestJson,
  AccountBulkOrderRequestsJson,
  AccountClientError,
  AccountDeleteJson,
  AccountOrderCancelJson,
  AccountOrderJson,
  AccountOrdersJson,
  AccountProductQuestionJson,
  AccountProductQuestionsJson,
  AccountReturnJson,
  AccountReturnReasonsJson,
  AccountShippingMethodsJson,
  AccountCouponPreviewJson,
  AccountReturnsJson,
  AccountReviewJson,
  AccountReviewsJson,
  AccountRefundAccountJson,
  OrderCancelCart,
  ProfileUpdateErrorJson,
  ProfileUpdateSuccessJson,
} from '@/types/api/account';
import type { User } from '@/types';
import { isAccountErrorCode, isAccountErrorReason } from '@/lib/account/messages';
import type {
  AddressPatchInput,
  AddressWriteInput,
} from '@/lib/account/validate';
import type { ReturnCreateInput } from '@/lib/account/returns';
import type { ReviewCreateInput } from '@/lib/account/reviews';
import type { ProductQuestionCreateInput } from '@/lib/account/product-questions';
import type { BulkOrderCreateInput } from '@/lib/account/bulk-orders';
import type { CheckoutCreateInput } from '@/lib/account/checkout';
import type { ProfilePatch } from '@/lib/account/profile';
import type { RefundAccountInput } from '@/lib/account/refund-account';

export type AccountClientResult<T> = { ok: true; data: T } | AccountClientError;

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    console.error('Account client received a non-JSON response', res.status);
    return undefined;
  }
}

export function asError(
  json: unknown,
  fallback: AccountClientError['code'],
): AccountClientError {
  if (
    json &&
    typeof json === 'object' &&
    'ok' in json &&
    (json as { ok: unknown }).ok === false
  ) {
    const code = 'code' in json ? (json as { code: unknown }).code : undefined;
    const error =
      'error' in json && typeof (json as { error: unknown }).error === 'string'
        ? (json as { error: string }).error
        : undefined;
    const fields =
      'fields' in json &&
      (json as { fields: unknown }).fields &&
      typeof (json as { fields: unknown }).fields === 'object'
        ? (json as AccountClientError).fields
        : undefined;
    const reason = 'reason' in json ? (json as { reason: unknown }).reason : undefined;
    if (isAccountErrorCode(code)) {
      return {
        ok: false,
        code,
        error,
        fields,
        ...(isAccountErrorReason(reason) ? { reason } : {}),
      };
    }
  }
  return { ok: false, code: fallback };
}

export async function accountRequest(
  path: string,
  init?: RequestInit,
): Promise<{ res: Response; json: unknown } | AccountClientError> {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    const json = await readJson(res);
    return { res, json };
  } catch (error) {
    console.error(
      'Account client request failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, code: 'unavailable' };
  }
}

export async function fetchAddresses(): Promise<
  AccountClientResult<Address[]>
> {
  const result = await accountRequest('/api/account/addresses');
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as AccountAddressesJson | undefined;
  if (json && json.ok === true && Array.isArray(json.addresses)) {
    return { ok: true, data: json.addresses };
  }
  return { ok: false, code: 'unavailable' };
}

export async function createAddress(
  input: AddressWriteInput,
): Promise<AccountClientResult<Address>> {
  const result = await accountRequest('/api/account/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as AccountAddressJson | undefined;
  if (json && json.ok === true && json.address) {
    return { ok: true, data: json.address };
  }
  return { ok: false, code: 'unavailable' };
}

export async function updateAddress(
  id: string,
  input: AddressPatchInput,
): Promise<AccountClientResult<Address>> {
  const result = await accountRequest(`/api/account/addresses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as AccountAddressJson | undefined;
  if (json && json.ok === true && json.address) {
    return { ok: true, data: json.address };
  }
  return { ok: false, code: 'unavailable' };
}

export async function deleteAddress(
  id: string,
): Promise<AccountClientResult<true>> {
  const result = await accountRequest(`/api/account/addresses/${id}`, {
    method: 'DELETE',
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as AccountDeleteJson | undefined;
  if (json && json.ok === true) {
    return { ok: true, data: true };
  }
  return { ok: false, code: 'unavailable' };
}

export async function fetchOrders(): Promise<
  AccountClientResult<{ orders: AccountOrder[]; meta: AccountOrdersMeta }>
> {
  const result = await accountRequest('/api/account/orders');
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as AccountOrdersJson | undefined;
  if (json && json.ok === true && Array.isArray(json.orders) && json.meta) {
    return { ok: true, data: { orders: json.orders, meta: json.meta } };
  }
  return { ok: false, code: 'unavailable' };
}

export async function fetchOrder(
  id: number,
): Promise<AccountClientResult<AccountOrderDetail>> {
  const result = await accountRequest(`/api/account/orders/${id}`);
  if ('ok' in result) return result;
  if (!result.res.ok) {
    const fallback =
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 403
          ? 'forbidden'
          : result.res.status === 404
            ? 'not_found'
            : result.res.status === 400
              ? 'invalid_input'
              : 'unavailable';
    return asError(result.json, fallback);
  }
  const json = result.json as AccountOrderJson | undefined;
  if (json && json.ok === true && json.order) {
    return { ok: true, data: json.order };
  }
  return { ok: false, code: 'unavailable' };
}

/** The error code to assume when a BFF error body can't be read. */
function codeForStatus(status: number): AccountClientError['code'] {
  switch (status) {
    case 400:
      return 'invalid_input';
    case 401:
      return 'unauthenticated';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 422:
      return 'validation';
    case 429:
      return 'rate_limited';
    default:
      return 'unavailable';
  }
}

async function orderPaymentAction(
  id: number,
  action: 'confirm-payment' | 'retry-payment',
): Promise<AccountClientResult<AccountOrderDetail>> {
  const result = await accountRequest(`/api/account/orders/${id}/${action}`, {
    method: 'POST',
  });
  if ('ok' in result) return result;
  if (!result.res.ok) return asError(result.json, codeForStatus(result.res.status));
  const json = result.json as AccountOrderJson | undefined;
  if (json && json.ok === true && json.order) {
    return { ok: true, data: json.order };
  }
  return { ok: false, code: 'unavailable' };
}

/**
 * POST /api/account/orders/{id}/confirm-payment — the backend asks Thawani
 * whether the order is paid and answers the order. Safe to repeat (limit 20 a
 * minute). Errors: `reason` `provider_unavailable` (couldn't check: never say
 * the payment failed), `payment_not_found`; `forbidden`, `not_found`,
 * `rate_limited`. It answers the whole order, the same as `fetchOrder`.
 */
export function confirmOrderPayment(
  id: number,
): Promise<AccountClientResult<AccountOrderDetail>> {
  return orderPaymentAction(id, 'confirm-payment');
}

/**
 * POST /api/account/orders/{id}/retry-payment — "Try again": answers the
 * order with `payment.redirectUrl` (the same page while it's still open, or a
 * new one). Errors: `reason` `payment_closed` (time is over / cancelled),
 * `provider_unavailable`; limit 10 a minute.
 */
export function retryOrderPayment(
  id: number,
): Promise<AccountClientResult<AccountOrderDetail>> {
  return orderPaymentAction(id, 'retry-payment');
}

/**
 * POST /api/account/orders/{id}/cancel — "Cancel order" on an unpaid order
 * (guide §5.3-b). Answers the cancelled order and what went back into the
 * cart. Errors: `reason` `not_cancellable` (paid, cancelled or failed
 * meanwhile: reload the order); `forbidden`, `not_found`, `rate_limited`
 * (10 a minute).
 */
export async function cancelOrder(
  id: number,
): Promise<AccountClientResult<{ order: AccountOrderDetail; cart: OrderCancelCart }>> {
  const result = await accountRequest(`/api/account/orders/${id}/cancel`, { method: 'POST' });
  if ('ok' in result) return result;
  if (!result.res.ok) return asError(result.json, codeForStatus(result.res.status));
  const json = result.json as AccountOrderCancelJson | undefined;
  if (json && json.ok === true && json.order && json.cart) {
    return { ok: true, data: { order: json.order, cart: json.cart } };
  }
  return { ok: false, code: 'unavailable' };
}

/**
 * POST /api/account/checkout — same-origin BFF.
 * shippingMethodId must be a positive integer from a shipping API or the
 * temporary checkout helper. Never hardcode a method id in source.
 */
export async function submitCheckout(
  input: CheckoutCreateInput,
): Promise<AccountClientResult<AccountOrderDetail>> {
  const result = await accountRequest('/api/account/checkout', {
    method: 'POST',
    body: JSON.stringify({
      addressId: input.addressId,
      shippingMethodId: input.shippingMethodId,
      couponCode: input.couponCode,
      idempotencyKey: input.idempotencyKey,
    }),
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    const fallback =
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 422
          ? 'validation'
          : result.res.status === 404
            ? 'not_found'
            : result.res.status === 400
              ? 'invalid_input'
              : 'unavailable';
    return asError(result.json, fallback);
  }
  const json = result.json as AccountOrderJson | undefined;
  if (json && json.ok === true && json.order) {
    return { ok: true, data: json.order };
  }
  return { ok: false, code: 'unavailable' };
}

export async function fetchShippingMethods(
  addressId: number,
): Promise<AccountClientResult<ShippingMethodOption[]>> {
  const result = await accountRequest(
    `/api/account/shipping-methods?address_id=${addressId}`,
  );
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 404
          ? 'not_found'
          : 'unavailable',
    );
  }
  const json = result.json as AccountShippingMethodsJson | undefined;
  if (json && json.ok === true && Array.isArray(json.methods)) {
    return { ok: true, data: json.methods };
  }
  return { ok: false, code: 'unavailable' };
}

export async function previewCoupon(input: {
  couponCode: string;
  addressId: number | null;
  shippingMethodId: number | null;
}): Promise<AccountClientResult<CouponPreview>> {
  const result = await accountRequest('/api/account/checkout/coupon-preview', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 422
          ? 'validation'
          : result.res.status === 400
            ? 'invalid_input'
            : 'unavailable',
    );
  }
  const json = result.json as AccountCouponPreviewJson | undefined;
  if (json && json.ok === true && json.preview) {
    return { ok: true, data: json.preview };
  }
  return { ok: false, code: 'unavailable' };
}

export async function fetchReturns(): Promise<
  AccountClientResult<{
    returns: AccountReturnRequest[];
    meta: AccountReturnsMeta;
  }>
> {
  const result = await accountRequest('/api/account/returns');
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as AccountReturnsJson | undefined;
  if (json && json.ok === true && Array.isArray(json.returns) && json.meta) {
    return { ok: true, data: { returns: json.returns, meta: json.meta } };
  }
  return { ok: false, code: 'unavailable' };
}

export async function fetchReturnReasons(): Promise<
  AccountClientResult<AccountReturnReasons>
> {
  const result = await accountRequest('/api/account/returns/reasons');
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as AccountReturnReasonsJson | undefined;
  if (json && json.ok === true && json.reasons) {
    return { ok: true, data: json.reasons };
  }
  return { ok: false, code: 'unavailable' };
}

export async function createReturn(
  input: ReturnCreateInput,
): Promise<AccountClientResult<AccountReturnRequest>> {
  const result = await accountRequest('/api/account/returns', {
    method: 'POST',
    body: JSON.stringify({
      orderItemId: input.orderItemId,
      quantity: input.quantity,
      reason: input.reason,
      note: input.note,
      ...(input.refundAccount
        ? {
            refundIban: input.refundAccount.iban,
            refundAccountName: input.refundAccount.accountName,
          }
        : {}),
    }),
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    const fallback =
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 422
          ? 'validation'
          : result.res.status === 404
            ? 'not_found'
            : result.res.status === 400
              ? 'invalid_input'
              : 'unavailable';
    return asError(result.json, fallback);
  }
  const json = result.json as AccountReturnJson | undefined;
  if (json && json.ok === true && json.returnRequest) {
    return { ok: true, data: json.returnRequest };
  }
  return { ok: false, code: 'unavailable' };
}

async function refundAccountRequest(
  init?: RequestInit,
): Promise<AccountClientResult<RefundBankAccount | null>> {
  const result = await accountRequest('/api/account/refund-account', init);
  if ('ok' in result) return result;
  if (!result.res.ok) return asError(result.json, codeForStatus(result.res.status));
  const json = result.json as AccountRefundAccountJson | undefined;
  if (json && json.ok === true && json.account !== undefined) {
    return { ok: true, data: json.account };
  }
  return { ok: false, code: 'unavailable' };
}

/** The bank account refunds are sent to; `null` when none is saved. */
export function fetchRefundAccount() {
  return refundAccountRequest();
}

/**
 * Save or replace it. A 422 has `fields.refund_iban` /
 * `fields.refund_account_name`: the backend's messages, in the store language.
 */
export function saveRefundAccount(input: RefundAccountInput) {
  return refundAccountRequest({ method: 'PUT', body: JSON.stringify(input) });
}

export function removeRefundAccount() {
  return refundAccountRequest({ method: 'DELETE' });
}

export async function cancelReturn(
  id: number,
): Promise<AccountClientResult<true>> {
  const result = await accountRequest(`/api/account/returns/${id}`, {
    method: 'DELETE',
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    const fallback =
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 403
          ? 'forbidden'
          : result.res.status === 404
            ? 'not_found'
            : result.res.status === 422
              ? 'validation'
              : result.res.status === 400
                ? 'invalid_input'
                : 'unavailable';
    return asError(result.json, fallback);
  }
  const json = result.json as AccountDeleteJson | undefined;
  if (json && json.ok === true) {
    return { ok: true, data: true };
  }
  return { ok: false, code: 'unavailable' };
}

export async function fetchReviews(): Promise<
  AccountClientResult<{
    reviews: AccountReview[];
    meta: AccountReviewsMeta;
  }>
> {
  const result = await accountRequest('/api/account/reviews');
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as AccountReviewsJson | undefined;
  if (json && json.ok === true && Array.isArray(json.reviews) && json.meta) {
    return { ok: true, data: { reviews: json.reviews, meta: json.meta } };
  }
  return { ok: false, code: 'unavailable' };
}

/** Edit a review; it goes back to moderation. */
export async function updateReview(
  id: number,
  input: { rating: number; comment: string | null },
): Promise<AccountClientResult<AccountReview>> {
  const result = await accountRequest(`/api/account/reviews/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ rating: input.rating, comment: input.comment }),
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    const fallback =
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 422
          ? 'validation'
          : result.res.status === 404
            ? 'not_found'
            : result.res.status === 400
              ? 'invalid_input'
              : 'unavailable';
    return asError(result.json, fallback);
  }
  const json = result.json as AccountReviewJson | undefined;
  if (json && json.ok === true && json.review) {
    return { ok: true, data: json.review };
  }
  return { ok: false, code: 'unavailable' };
}

/** Delete a review for good; the item can then be reviewed again. */
export async function deleteReview(id: number): Promise<AccountClientResult<true>> {
  const result = await accountRequest(`/api/account/reviews/${id}`, { method: 'DELETE' });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : result.res.status === 404 ? 'not_found' : 'unavailable',
    );
  }
  const json = result.json as AccountDeleteJson | undefined;
  if (json && json.ok === true) return { ok: true, data: true };
  return { ok: false, code: 'unavailable' };
}

export async function createReview(
  input: ReviewCreateInput,
): Promise<AccountClientResult<AccountReview>> {
  const result = await accountRequest('/api/account/reviews', {
    method: 'POST',
    body: JSON.stringify({
      orderItemId: input.orderItemId,
      rating: input.rating,
      comment: input.comment,
    }),
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    const fallback =
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 422
          ? 'validation'
          : result.res.status === 404
            ? 'not_found'
            : result.res.status === 400
              ? 'invalid_input'
              : 'unavailable';
    return asError(result.json, fallback);
  }
  const json = result.json as AccountReviewJson | undefined;
  if (json && json.ok === true && json.review) {
    return { ok: true, data: json.review };
  }
  return { ok: false, code: 'unavailable' };
}

export async function fetchProductQuestions(): Promise<
  AccountClientResult<{
    questions: AccountProductQuestion[];
    meta: AccountProductQuestionsMeta;
  }>
> {
  const result = await accountRequest('/api/account/product-questions');
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as AccountProductQuestionsJson | undefined;
  if (
    json &&
    json.ok === true &&
    Array.isArray(json.questions) &&
    json.meta
  ) {
    return {
      ok: true,
      data: { questions: json.questions, meta: json.meta },
    };
  }
  return { ok: false, code: 'unavailable' };
}

export async function createProductQuestion(
  input: ProductQuestionCreateInput,
): Promise<AccountClientResult<AccountProductQuestion>> {
  const result = await accountRequest('/api/account/product-questions', {
    method: 'POST',
    body: JSON.stringify({
      productId: input.productId,
      question: input.question,
    }),
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    const fallback =
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 422
          ? 'validation'
          : result.res.status === 400
            ? 'invalid_input'
            : 'unavailable';
    return asError(result.json, fallback);
  }
  const json = result.json as AccountProductQuestionJson | undefined;
  if (json && json.ok === true && json.question) {
    return { ok: true, data: json.question };
  }
  return { ok: false, code: 'unavailable' };
}

export async function fetchBulkOrderRequests(
  page = 1,
): Promise<
  AccountClientResult<{
    requests: AccountBulkOrderRequest[];
    meta: AccountBulkOrderRequestsMeta;
  }>
> {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const result = await accountRequest(
    `/api/account/bulk-order-requests?page=${safePage}`,
  );
  if ('ok' in result) return result;
  if (!result.res.ok) {
    return asError(
      result.json,
      result.res.status === 401 ? 'unauthenticated' : 'unavailable',
    );
  }
  const json = result.json as AccountBulkOrderRequestsJson | undefined;
  if (
    json &&
    json.ok === true &&
    Array.isArray(json.requests) &&
    json.meta
  ) {
    return {
      ok: true,
      data: { requests: json.requests, meta: json.meta },
    };
  }
  return { ok: false, code: 'unavailable' };
}

export async function createBulkOrderRequest(
  input: BulkOrderCreateInput,
): Promise<AccountClientResult<AccountBulkOrderRequest>> {
  const result = await accountRequest('/api/account/bulk-order-requests', {
    method: 'POST',
    body: JSON.stringify({
      productId: input.productId,
      variantId: input.variantId,
      quantity: input.quantity,
      note: input.note,
    }),
  });
  if ('ok' in result) return result;
  if (!result.res.ok) {
    const fallback =
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 422
          ? 'validation'
          : result.res.status === 403
            ? 'forbidden'
            : result.res.status === 400
              ? 'invalid_input'
              : 'unavailable';
    return asError(result.json, fallback);
  }
  const json = result.json as AccountBulkOrderRequestJson | undefined;
  if (json && json.ok === true && json.request) {
    return { ok: true, data: json.request };
  }
  return { ok: false, code: 'unavailable' };
}

export async function acceptBulkOrderRequest(
  id: number,
): Promise<AccountClientResult<AccountBulkOrderRequest>> {
  const result = await accountRequest(
    `/api/account/bulk-order-requests/${id}/accept`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  if ('ok' in result) return result;
  if (!result.res.ok) {
    const fallback =
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 422
          ? 'validation'
          : result.res.status === 403
            ? 'forbidden'
            : result.res.status === 404
              ? 'not_found'
              : result.res.status === 400
                ? 'invalid_input'
                : 'unavailable';
    return asError(result.json, fallback);
  }
  const json = result.json as AccountBulkOrderRequestJson | undefined;
  if (json && json.ok === true && json.request) {
    return { ok: true, data: json.request };
  }
  return { ok: false, code: 'unavailable' };
}

export async function cancelBulkOrderRequest(
  id: number,
): Promise<AccountClientResult<true>> {
  const result = await accountRequest(
    `/api/account/bulk-order-requests/${id}`,
    { method: 'DELETE' },
  );
  if ('ok' in result) return result;
  if (!result.res.ok) {
    const fallback =
      result.res.status === 401
        ? 'unauthenticated'
        : result.res.status === 422
          ? 'validation'
          : result.res.status === 403
            ? 'forbidden'
            : result.res.status === 404
              ? 'not_found'
              : result.res.status === 400
                ? 'invalid_input'
                : 'unavailable';
    return asError(result.json, fallback);
  }
  const json = result.json as AccountDeleteJson | undefined;
  if (json && json.ok === true) {
    return { ok: true, data: true };
  }
  return { ok: false, code: 'unavailable' };
}

export type ProfileUpdateClientResult =
  | { ok: true; user: User }
  | ProfileUpdateErrorJson;

function parseProfileUpdateResult(
  res: Response,
  data: unknown,
): ProfileUpdateClientResult {
  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === true &&
    'user' in data &&
    (data as ProfileUpdateSuccessJson).user
  ) {
    return { ok: true, user: (data as ProfileUpdateSuccessJson).user };
  }

  if (
    data &&
    typeof data === 'object' &&
    'ok' in data &&
    (data as { ok: unknown }).ok === false
  ) {
    const code = 'code' in data ? (data as { code: unknown }).code : undefined;
    if (
      code === 'invalid_input' ||
      code === 'validation' ||
      code === 'unauthenticated' ||
      code === 'unavailable'
    ) {
      const fields =
        'fields' in data && data.fields && typeof data.fields === 'object'
          ? (data as ProfileUpdateErrorJson).fields
          : undefined;
      return { ok: false, code, fields };
    }
  }

  if (res.status === 401) return { ok: false, code: 'unauthenticated' };
  if (res.status === 400) return { ok: false, code: 'invalid_input' };
  if (res.status === 422) return { ok: false, code: 'validation' };
  return { ok: false, code: 'unavailable' };
}

export async function uploadProfileAvatar(
  file: File,
): Promise<ProfileUpdateClientResult> {
  const form = new FormData();
  form.append('avatar', file, file.name);
  let res: Response;
  try {
    res = await fetch('/api/account/profile/avatar', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      body: form,
    });
  } catch (error) {
    console.error(
      'Avatar upload request failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, code: 'unavailable' };
  }
  let data: unknown;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = undefined;
    }
  }
  return parseProfileUpdateResult(res, data);
}

export async function patchAccountProfile(
  input: ProfilePatch,
): Promise<ProfileUpdateClientResult> {
  let res: Response;
  try {
    res = await fetch('/api/account/profile', {
      method: 'PATCH',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    console.error(
      'Profile update request failed',
      error instanceof Error ? error.name : 'unknown',
    );
    return { ok: false, code: 'unavailable' };
  }

  const text = await res.text();
  let data: unknown;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      console.error('Profile update received a non-JSON response', res.status);
      data = undefined;
    }
  }

  return parseProfileUpdateResult(res, data);
}
