'use client';

import { Clock, CreditCard, Loader2, RotateCcw, ShoppingBag, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cancelOrderButtonClass, changeOrderButtonClass } from '@/lib/checkout/useCancelOrder';
import {
  formatTimeLeft,
  getOrderPaymentState,
  paymentDeadline,
  type OrderPaymentFields,
} from '@/lib/account/payment-state';

type Props = {
  order: OrderPaymentFields;
  /** From `useNow`, so the countdown runs and "time over" appears on time. */
  now: number;
  /** "Complete payment" / "Try again" is running or the browser is leaving. */
  busy: boolean;
  onPay: () => void;
  /** `row`: countdown + button under an orders-list row. `panel`: the order page. */
  variant: 'row' | 'panel';
  /** "Order again" for an order that can't be paid any more (P9). */
  orderAgain?: { busy: boolean; onClick: () => void } | null;
  /** "Cancel order" while it can still be paid (guide §4.6 A and B, §5.3-b). */
  onCancel?: (() => void) | null;
  /** "Change order" (cancel, then the cart) next to it; the order page only. */
  onChangeOrder?: (() => void) | null;
};

/** "Pay within 12:34" — the time stays left-to-right inside Arabic text. */
export function PaymentCountdown({ deadline, now }: { deadline: number; now: number }) {
  const { t } = useLanguage();
  const [before, after] = t.checkout.payWithin.split('{time}');
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
      <Clock size={12} aria-hidden />
      <span>
        {before}
        <bdi dir="ltr" className="tabular-nums">
          {formatTimeLeft(deadline - now)}
        </bdi>
        {after}
      </span>
    </span>
  );
}

/**
 * What an order says and offers about its payment (guide §4.6): "Complete
 * payment" or "Try again" with a countdown while it can still be paid, and an
 * explanation once it can't. Paid orders show nothing here.
 */
export default function OrderPaymentActions({
  order,
  now,
  busy,
  onPay,
  variant,
  orderAgain = null,
  onCancel = null,
  onChangeOrder = null,
}: Props) {
  const { t } = useLanguage();
  const state = getOrderPaymentState(order, now);
  if (state === 'paid') return null;

  const deadline = paymentDeadline(order);
  const payable = state === 'awaiting_payment' || state === 'payment_cancelled_retry';
  // The mock gateway has no pay page: the order waits for the admin.
  const canPay =
    state === 'payment_cancelled_retry' ||
    (state === 'awaiting_payment' && order.payment?.redirectUrl != null);

  const payButton = canPay ? (
    <button
      type="button"
      onClick={onPay}
      disabled={busy}
      aria-busy={busy}
      className={
        variant === 'row'
          ? 'h-9 px-4 bg-[#C9A84C] text-[#2D1F1F] text-[10px] font-black tracking-[0.15em] uppercase rounded-md inline-flex items-center gap-2 hover:bg-[#2D1F1F] hover:text-white transition-colors disabled:opacity-60'
          : 'w-full sm:w-auto h-12 px-6 bg-[#C9A84C] text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase rounded-md inline-flex items-center justify-center gap-2 hover:bg-[#2D1F1F] hover:text-white transition-colors disabled:opacity-60'
      }
    >
      {busy ? (
        <Loader2 size={13} className="animate-spin" aria-hidden />
      ) : state === 'payment_cancelled_retry' ? (
        <RotateCcw size={13} aria-hidden />
      ) : (
        <CreditCard size={13} aria-hidden />
      )}
      {state === 'payment_cancelled_retry' ? t.checkout.retryPayment : t.checkout.completePayment}
    </button>
  ) : null;

  const cancelButton =
    onCancel && payable ? (
      <button type="button" onClick={onCancel} disabled={busy} className={cancelOrderButtonClass}>
        {t.checkout.cancelOrder}
      </button>
    ) : null;

  const changeButton =
    onChangeOrder && payable && variant === 'panel' ? (
      <button type="button" onClick={onChangeOrder} disabled={busy} className={changeOrderButtonClass}>
        {t.checkout.changeOrder}
      </button>
    ) : null;

  const orderAgainButton =
    orderAgain && (state === 'payment_window_over' || state === 'failed') ? (
      <button
        type="button"
        onClick={orderAgain.onClick}
        disabled={orderAgain.busy}
        aria-busy={orderAgain.busy}
        className="w-full sm:w-auto h-12 px-6 border border-[#2D1F1F]/20 text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase rounded-md inline-flex items-center justify-center gap-2 hover:bg-[#2D1F1F] hover:text-white transition-colors disabled:opacity-60"
      >
        {orderAgain.busy ? (
          <Loader2 size={13} className="animate-spin" aria-hidden />
        ) : (
          <ShoppingBag size={13} aria-hidden />
        )}
        {t.account.orderAgain}
      </button>
    ) : null;

  if (variant === 'row') {
    // The list only offers the next step; the badge already names the state.
    if (!payable || (!payButton && !cancelButton && deadline === null)) return null;
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {deadline !== null ? <PaymentCountdown deadline={deadline} now={now} /> : null}
        {payButton}
        {cancelButton}
      </div>
    );
  }

  const copy: Record<Exclude<typeof state, 'paid'>, [string, string]> = {
    awaiting_payment: canPay
      ? [t.checkout.paymentNotCompleteTitle, t.checkout.paymentNotCompleteDesc]
      : [t.checkout.awaitingConfirmationTitle, t.checkout.awaitingConfirmationDesc],
    payment_cancelled_retry: [t.checkout.paymentCancelledTitle, t.checkout.paymentCancelledDesc],
    payment_window_over: [t.checkout.paymentWindowOverTitle, t.checkout.paymentWindowOverDesc],
    failed: [t.checkout.orderNotPaidTitle, t.checkout.orderNotPaidDesc],
    // This box is on the order page, above the refund lines.
    cancelled_refunded: [t.checkout.orderCancelledTitle, t.account.refundShownBelow],
    cancelled_unpaid: [t.checkout.orderCancelledTitle, t.checkout.orderCancelledUnpaidDesc],
  };
  const [title, desc] = copy[state];

  return (
    <section
      aria-live="polite"
      className={`rounded-xl border p-6 sm:p-8 ${
        payable ? 'border-amber-200 bg-amber-50/60' : 'border-[#2D1F1F]/8 bg-[#FAF7F2]'
      }`}
    >
      <div className="flex items-start gap-3">
        {payable ? (
          <Clock size={20} className="text-amber-700 flex-shrink-0 mt-0.5" aria-hidden />
        ) : (
          <XCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" aria-hidden />
        )}
        <div className="flex-1 min-w-0 text-start">
          <h2 className="text-sm font-bold text-[#2D1F1F]">{title}</h2>
          <p className="text-sm text-[#2D1F1F]/65 mt-1 leading-relaxed">{desc}</p>
          {payable && deadline !== null ? (
            <div className="mt-3">
              <PaymentCountdown deadline={deadline} now={now} />
            </div>
          ) : null}
        </div>
      </div>
      {payButton || orderAgainButton ? (
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          {payButton}
          {orderAgainButton}
        </div>
      ) : null}
      {changeButton || cancelButton ? (
        <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-3">
          {changeButton}
          {cancelButton}
        </div>
      ) : null}
    </section>
  );
}
