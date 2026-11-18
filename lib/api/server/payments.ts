import 'server-only';

import type { AccountOrderDetail } from '@/types';
import type {
  AccountClientError,
  AccountErrorReason,
  OrderCancelCart,
} from '@/types/api/account';
import { firstValidationMessage } from '@/lib/mappers/auth';
import { parseLaravelOrderDetail } from '@/lib/mappers/account';
import type { AccountOpResult } from './account';
import { GATEWAY_REQUEST_TIMEOUT_MS, laravelCustomerFetch, withCustomerAuth } from './customer-auth';
import { laravelErrorCode } from './error-code';

/** The backend's 422 `code` → what the store does about it. */
const PAYMENT_REASONS: Record<string, AccountErrorReason> = {
  // Thawani didn't answer: say "couldn't check", never "payment failed".
  payment_provider_unavailable: 'provider_unavailable',
  payment_not_found: 'payment_not_found',
  // The time to pay is over, or the order was cancelled.
  order_payment_closed: 'payment_closed',
  // "Cancel order" on an order that was paid, cancelled or failed meanwhile.
  order_not_cancellable: 'not_cancellable',
};

type OrderAction = 'confirm-payment' | 'retry-payment' | 'cancel';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `meta.cart` of a cancel: how many lines went back, and the names of those that couldn't. */
function parseCancelCart(body: unknown): OrderCancelCart {
  const meta = isRecord(body) && isRecord(body.meta) ? body.meta : null;
  const cart = meta && isRecord(meta.cart) ? meta.cart : null;
  const restored =
    cart && typeof cart.restored === 'number' && cart.restored >= 0 ? Math.floor(cart.restored) : 0;
  const skipped =
    cart && Array.isArray(cart.skipped)
      ? cart.skipped
          .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
          .map((name) => name.trim())
      : [];
  return { restored, skipped };
}

/**
 * POST /customer/orders/{id}/confirm-payment, /retry-payment or /cancel (no
 * body, owner only). All three answer the whole order, the same as the order
 * page (guide §2.2), so no reload is needed after them.
 */
async function laravelOrderAction<T>(
  orderId: number,
  action: OrderAction,
  read: (order: AccountOrderDetail, body: unknown) => T,
): Promise<AccountOpResult<T>> {
  const attempt = await withCustomerAuth((accessToken) =>
    laravelCustomerFetch(`/customer/orders/${orderId}/${action}`, {
      method: 'POST',
      accessToken,
      timeoutMs: GATEWAY_REQUEST_TIMEOUT_MS,
    }),
  );
  const cookies = {
    rotatedTokens: attempt.rotatedTokens,
    remember: attempt.remember,
    clearAuth: attempt.clearAuth,
  };
  const fail = (error: AccountClientError): AccountOpResult<T> => ({
    ok: false,
    error,
    ...cookies,
  });

  const { result } = attempt;
  if (result.unreachable) return fail({ ok: false, code: 'unavailable' });

  switch (result.status) {
    case 200: {
      const order = parseLaravelOrderDetail(result.data);
      if (order) return { ok: true, data: read(order, result.data), ...cookies };
      console.error(`Laravel ${action} payload could not be mapped`);
      return fail({ ok: false, code: 'unavailable' });
    }
    case 401:
      return fail({ ok: false, code: 'unauthenticated' });
    case 403:
      return fail({ ok: false, code: 'forbidden' });
    case 404:
      return fail({ ok: false, code: 'not_found' });
    // 20 confirms / 10 retries / 10 cancels a minute per customer.
    case 429:
      return fail({ ok: false, code: 'rate_limited' });
    case 422:
      return fail({
        ok: false,
        code: 'validation',
        reason: PAYMENT_REASONS[laravelErrorCode(result.data) ?? ''],
        error: firstValidationMessage(result.data),
      });
    default:
      return fail({ ok: false, code: 'unavailable' });
  }
}

/** Asks the backend (which asks Thawani) whether the order is paid. Safe to repeat. */
export function confirmLaravelPayment(orderId: number) {
  return laravelOrderAction(orderId, 'confirm-payment', (order) => order);
}

/** The open pay page again, or a new one after a cancelled attempt. */
export function retryLaravelPayment(orderId: number) {
  return laravelOrderAction(orderId, 'retry-payment', (order) => order);
}

/**
 * "Cancel order" on an unpaid order (guide §5.3-b): the backend checks with
 * Thawani first, then cancels, releases the stock and coupon, and puts the
 * lines back in the cart. 422 `order_not_cancellable` once it isn't awaiting
 * payment any more.
 */
export function cancelLaravelOrder(orderId: number) {
  return laravelOrderAction(orderId, 'cancel', (order, body) => ({
    order,
    cart: parseCancelCart(body),
  }));
}
