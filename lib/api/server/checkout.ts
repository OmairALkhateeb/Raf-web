import 'server-only';

import type { AccountOrderDetail, CouponPreview, ShippingMethodOption } from '@/types';
import type { AccountClientError, AccountErrorReason } from '@/types/api/account';
import type { LaravelAuthTokensDto } from '@/types/api/auth';
import type { CheckoutCreateInput } from '@/lib/account/checkout';
import { toLaravelCheckoutBody } from '@/lib/account/checkout';
import { firstValidationMessage } from '@/lib/mappers/auth';
import { parseLaravelOrderDetail } from '@/lib/mappers/account';
import { parseCouponPreview, parseShippingMethods } from '@/lib/mappers/checkout';
import { GATEWAY_REQUEST_TIMEOUT_MS, laravelCustomerFetch, withCustomerAuth } from './customer-auth';
import { laravelErrorCode } from './error-code';

/** The checkout 422 `code`s the page acts on (guide §13). */
const CHECKOUT_REASONS: Record<string, AccountErrorReason> = {
  // Thawani didn't answer: no order was made and the cart is unchanged.
  payment_provider_unavailable: 'provider_unavailable',
  // The key belongs to another account: make a new one and send again.
  idempotency_key_used: 'key_used',
  cart_empty: 'cart_empty',
  insufficient_stock: 'cart_items',
  product_unavailable: 'cart_items',
  variant_unavailable: 'cart_items',
  bundle_unavailable: 'cart_items',
  coupon_invalid: 'coupon',
  coupon_minimum_not_met: 'coupon',
  coupon_usage_limit: 'coupon',
  coupon_first_order_only: 'coupon',
  coupon_not_applicable: 'coupon',
  // 15/10/2026: an address or method we don't deliver to is refused before
  // any order (it used to go through with free shipping).
  address_not_deliverable: 'address_not_deliverable',
  shipping_method_unavailable: 'shipping_method_unavailable',
};

export type CheckoutOpSuccess<T> = {
  ok: true;
  data: T;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type CheckoutOpFailure = {
  ok: false;
  error: AccountClientError;
  rotatedTokens?: LaravelAuthTokensDto;
  remember: boolean;
  clearAuth?: boolean;
};

export type CheckoutOpResult<T> = CheckoutOpSuccess<T> | CheckoutOpFailure;

function unavailable(): CheckoutOpFailure {
  return {
    ok: false,
    error: { ok: false, code: 'unavailable' },
    remember: true,
  };
}

function withCookies<T>(
  result: CheckoutOpResult<T>,
  attempt: {
    rotatedTokens?: LaravelAuthTokensDto;
    remember: boolean;
    clearAuth: boolean;
  },
): CheckoutOpResult<T> {
  return {
    ...result,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

function failure(
  attempt: { rotatedTokens?: LaravelAuthTokensDto; remember: boolean; clearAuth: boolean },
  error: AccountClientError,
): CheckoutOpFailure {
  return {
    ok: false,
    error,
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
}

/**
 * GET /api/customer/shipping-methods?address_id= — every active method with
 * its fee for the current cart and that address's zone.
 */
export async function getLaravelShippingMethods(
  addressId: number,
): Promise<CheckoutOpResult<ShippingMethodOption[]>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(`/customer/shipping-methods?address_id=${addressId}`, {
      method: 'GET',
      accessToken,
    }),
  );
  const { result } = attempt;

  if (result.unreachable) return withCookies(unavailable(), attempt);
  if (result.status === 401) return failure(attempt, { ok: false, code: 'unauthenticated' });
  // The address isn't this customer's (firstOrFail).
  if (result.status === 404) return failure(attempt, { ok: false, code: 'not_found' });
  if (result.status !== 200) return withCookies(unavailable(), attempt);

  const methods = parseShippingMethods(result.data);
  if (!methods) {
    console.error('Laravel shipping methods payload could not be mapped');
    return withCookies(unavailable(), attempt);
  }
  return withCookies({ ok: true, data: methods, remember: attempt.remember }, attempt);
}

export type CouponPreviewInput = {
  couponCode: string;
  addressId: number | null;
  shippingMethodId: number | null;
};

/**
 * POST /api/customer/checkout/coupon-preview. Errors arrive under `coupon`
 * (invalid, expired, minimum order, usage limit, first order only, not for
 * these items) or `cart` (empty / unavailable product).
 */
export async function previewLaravelCoupon(
  input: CouponPreviewInput,
): Promise<CheckoutOpResult<CouponPreview>> {
  const body: Record<string, unknown> = { coupon_code: input.couponCode };
  if (input.addressId) body.address_id = input.addressId;
  if (input.shippingMethodId) body.shipping_method_id = input.shippingMethodId;

  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/checkout/coupon-preview', {
      method: 'POST',
      accessToken,
      body,
    }),
  );
  const { result } = attempt;

  if (result.unreachable) return withCookies(unavailable(), attempt);
  if (result.status === 401) return failure(attempt, { ok: false, code: 'unauthenticated' });
  if (result.status === 422) {
    return failure(attempt, {
      ok: false,
      code: 'validation',
      error: firstValidationMessage(result.data) ?? undefined,
    });
  }
  if (result.status !== 200) return withCookies(unavailable(), attempt);

  const preview = parseCouponPreview(result.data);
  if (!preview) {
    console.error('Laravel coupon preview payload could not be mapped');
    return withCookies(unavailable(), attempt);
  }
  return withCookies({ ok: true, data: preview, remember: attempt.remember }, attempt);
}

/**
 * POST /api/customer/checkout → normalized OrderResource (201).
 * Does not accept client prices, payment method, notes, or card data.
 */
export async function createLaravelCheckout(
  input: CheckoutCreateInput,
): Promise<CheckoutOpResult<AccountOrderDetail>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch('/customer/checkout', {
      method: 'POST',
      accessToken,
      body: toLaravelCheckoutBody(input),
      // The backend opens the Thawani pay page before answering.
      timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS,
    }),
  );

  const { result } = attempt;

  if (result.unreachable) {
    return withCookies(unavailable(), attempt);
  }

  if (result.status === 401) {
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'unauthenticated' },
        remember: attempt.remember,
      },
      attempt,
    );
  }

  if (result.status === 404) {
    return withCookies(
      {
        ok: false,
        error: { ok: false, code: 'not_found' },
        remember: attempt.remember,
      },
      attempt,
    );
  }

  if (result.status === 422) {
    return withCookies(
      {
        ok: false,
        error: {
          ok: false,
          code: 'validation',
          reason: CHECKOUT_REASONS[laravelErrorCode(result.data) ?? ''],
          error:
            firstValidationMessage(result.data) ??
            'Please check your checkout details and try again.',
        },
        remember: attempt.remember,
      },
      attempt,
    );
  }

  if (result.status === 503 || result.status >= 500) {
    return withCookies(unavailable(), attempt);
  }

  if (result.status !== 201) {
    return withCookies(unavailable(), attempt);
  }

  const order = parseLaravelOrderDetail(result.data);
  if (!order) {
    console.error('Laravel checkout order payload could not be mapped', 201);
    return withCookies(unavailable(), attempt);
  }

  return withCookies(
    { ok: true, data: order, remember: attempt.remember },
    attempt,
  );
}
