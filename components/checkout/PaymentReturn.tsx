'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  Home,
  Loader2,
  Package,
  RotateCcw,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useApp } from '@/contexts/AppContext';
import { confirmOrderPayment } from '@/lib/api/account';
import { localizeOrderDetailError, localizePaymentError } from '@/lib/account/messages';
import {
  formatTimeLeft,
  getOrderPaymentState,
  isPayableState,
  paymentDeadline,
} from '@/lib/account/payment-state';
import { useNow } from '@/lib/account/useNow';
import { forgetPendingPayment } from '@/lib/checkout/pending-payment';
import { startPayment } from '@/lib/checkout/start-payment';
import { useOrderAgain } from '@/lib/checkout/useOrderAgain';
import {
  cancelOrderButtonClass,
  changeOrderButtonClass,
  useCancelOrder,
} from '@/lib/checkout/useCancelOrder';
import OrderCancelledNotice from '@/components/account/OrderCancelledNotice';
import { loginHref } from '@/lib/auth/next-path';
import { formatMoney } from '@/utils/formatPrice';
import type { AccountOrderDetail } from '@/types';
import type { AccountClientError, OrderCancelCart } from '@/types/api/account';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

const secondaryButton =
  'w-full sm:flex-1 h-12 border border-[#2D1F1F]/20 rounded-md text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase flex items-center justify-center gap-2 hover:border-[#2D1F1F] hover:bg-[#2D1F1F] hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
const primaryButton =
  'w-full sm:flex-1 h-12 bg-[#C9A84C] text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase flex items-center justify-center gap-2 rounded-md hover:bg-[#2D1F1F] hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

/** Thawani can take a moment to mark a payment paid after sending the customer back. */
const SECOND_CHECK_DELAY_MS = 4000;

type Phase =
  | { kind: 'checking' }
  | { kind: 'order'; order: AccountOrderDetail }
  | { kind: 'error'; error: AccountClientError };

type Tone = 'success' | 'waiting' | 'closed' | 'warning';

const TONE_ICON: Record<Tone, { Icon: typeof CheckCircle; className: string }> = {
  success: { Icon: CheckCircle, className: 'bg-[#C9A84C]/10 text-[#C9A84C]' },
  waiting: { Icon: Clock, className: 'bg-amber-50 text-amber-700' },
  closed: { Icon: XCircle, className: 'bg-red-50 text-red-600' },
  warning: { Icon: AlertTriangle, className: 'bg-amber-50 text-amber-700' },
};

function parseOrderId(raw: string | null): number | null {
  return raw && /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `/checkout/success` and `/checkout/cancel`: where Thawani sends the customer
 * back (`?order=…&order_id=…`). Reaching this page proves nothing, so it asks
 * the backend to check the payment with Thawani (confirm-payment) and shows
 * what the answer says (guide §6.2). Reloading only checks again.
 */
export default function PaymentReturn({ variant }: { variant: 'success' | 'cancel' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, isRTL, language } = useLanguage();
  const { isAuthenticated, isAuthLoading, logout } = useAuth();
  const { refreshCart } = useCart();
  const { showToast } = useApp();
  const { orderAgain, busy: orderAgainBusy } = useOrderAgain();

  const orderId = parseOrderId(searchParams.get('order_id'));
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  // While "Try again" runs or the browser is leaving for Thawani.
  const [busy, setBusy] = useState(false);
  const epochRef = useRef(0);

  const toLogin = useCallback(() => {
    router.replace(loginHref(`${window.location.pathname}${window.location.search}`));
  }, [router]);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) toLogin();
  }, [isAuthLoading, isAuthenticated, toLogin]);

  const showOrder = useCallback(
    (order: AccountOrderDetail) => {
      const state = getOrderPaymentState(order, Date.now());
      if (!isPayableState(state)) forgetPendingPayment();
      // The cart was emptied at checkout; make sure the header badge shows it.
      if (state === 'paid') void refreshCart();
      setPhase({ kind: 'order', order });
    },
    [refreshCart],
  );

  const check = useCallback(async () => {
    if (orderId === null) return;
    const epoch = ++epochRef.current;
    setPhase({ kind: 'checking' });
    let result = await confirmOrderPayment(orderId);
    if (
      variant === 'success' &&
      result.ok &&
      getOrderPaymentState(result.data, Date.now()) === 'awaiting_payment'
    ) {
      await wait(SECOND_CHECK_DELAY_MS);
      if (epoch !== epochRef.current) return;
      result = await confirmOrderPayment(orderId);
    }
    if (epoch !== epochRef.current) return;
    if (!result.ok) {
      if (result.code === 'unauthenticated') {
        await logout();
        toLogin();
        return;
      }
      setPhase({ kind: 'error', error: result });
      return;
    }
    showOrder(result.data);
  }, [orderId, variant, logout, toLogin, showOrder]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || orderId === null) return;
    void (async () => {
      await check();
    })();
  }, [isAuthLoading, isAuthenticated, orderId, check]);

  // Coming back with the browser's Back button can restore this page from
  // its cache, still "leaving for Thawani": check the payment again.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setBusy(false);
      void check();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [check]);

  const order = phase.kind === 'order' ? phase.order : null;
  // Ticks while the order can still be paid, so the countdown runs and the
  // page switches to "time is over" by itself at the deadline.
  const now = useNow(order?.status === 'pending_payment');

  // "Cancel order" (states A and B): the page then shows the cancelled order.
  const [cancelledCart, setCancelledCart] = useState<OrderCancelCart | null>(null);
  const { requestCancel, cancelDialog } = useCancelOrder({
    notice: 'inline',
    onCancelled: ({ order: cancelled, cart }) => {
      epochRef.current += 1;
      setCancelledCart(cart);
      showOrder(cancelled);
    },
    onStale: () => void check(),
  });

  /** "Complete payment" (open page) and "Try again" (new page) alike. */
  const pay = async (target: AccountOrderDetail) => {
    if (busy) return;
    setBusy(true);
    const result = await startPayment(target);
    if (result.ok && result.redirected) return;
    setBusy(false);
    if (result.ok) {
      showOrder(result.order);
      return;
    }
    if (result.code === 'unauthenticated') {
      await logout();
      toLogin();
      return;
    }
    // The time ran out meanwhile: show the order as it is now.
    if (result.reason === 'payment_closed') {
      await check();
      return;
    }
    showToast(localizePaymentError(result, t), 'error');
  };

  const frame = (eyebrow: string, title: string, body: ReactNode) => (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {eyebrow}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">{title}</h1>
        </div>
      </div>
      <div className={`${cx} py-16 sm:py-24`}>
        <div className="max-w-lg mx-auto text-center">{body}</div>
      </div>
      {cancelDialog}
    </div>
  );

  const message = (
    tone: Tone,
    text: string,
    extra: ReactNode,
    actions: ReactNode,
    footer: ReactNode = null,
  ) => {
    const { Icon, className } = TONE_ICON[tone];
    return (
      <>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14 }}
          className="mb-8"
        >
          <div className={`w-20 h-20 flex items-center justify-center mx-auto rounded-full ${className}`}>
            <Icon size={40} strokeWidth={1.5} aria-hidden />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <p className="text-[#2D1F1F]/60 text-sm mb-4 leading-relaxed">{text}</p>
          {extra}
          {/* On phones the main action (last) comes first. */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-10">{actions}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </motion.div>
      </>
    );
  };

  const viewOrderLink = (id: number) => (
    <Link href={`/account/orders/${id}`} className={secondaryButton}>
      <Package size={14} aria-hidden />
      {t.checkout.viewOrder}
    </Link>
  );

  const shopLink = (
    <Link href="/" className={primaryButton}>
      <Home size={14} aria-hidden />
      {t.checkout.continueShopping}
    </Link>
  );

  const checkAgainButton = (
    <button type="button" onClick={() => void check()} className={primaryButton}>
      <RotateCcw size={14} aria-hidden />
      {t.checkout.checkAgain}
    </button>
  );

  const orderSummary = (target: AccountOrderDetail) => (
    <>
      <p className="text-sm font-bold text-[#C9A84C] tracking-widest mb-2 break-all">
        #{target.orderNumber}
      </p>
      <p className="text-sm text-[#2D1F1F] font-medium">
        {formatMoney(target.grandTotal, language, target.currency, t.common.omr)}
      </p>
    </>
  );

  const countdown = (target: AccountOrderDetail) => {
    const deadline = paymentDeadline(target);
    if (deadline === null) return null;
    const [before, after] = t.checkout.payWithin.split('{time}');
    return (
      <p className="mt-4 inline-flex items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
        <Clock size={13} aria-hidden />
        <span>
          {before}
          <bdi dir="ltr" className="tabular-nums">
            {formatTimeLeft(deadline - now)}
          </bdi>
          {after}
        </span>
      </p>
    );
  };

  // While it can still be paid: "Change order" (cancel, then the cart) and "Cancel order".
  const cancelButton = (target: AccountOrderDetail) => (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
      <button
        type="button"
        onClick={() => requestCancel(target, 'change')}
        disabled={busy}
        className={changeOrderButtonClass}
      >
        {t.checkout.changeOrder}
      </button>
      <button
        type="button"
        onClick={() => requestCancel(target)}
        disabled={busy}
        className={cancelOrderButtonClass}
      >
        {t.checkout.cancelOrder}
      </button>
    </div>
  );

  const payButton = (target: AccountOrderDetail, label: string, Icon: typeof CreditCard) => (
    <button
      type="button"
      onClick={() => void pay(target)}
      disabled={busy}
      aria-busy={busy}
      className={primaryButton}
    >
      {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Icon size={14} aria-hidden />}
      {label}
    </button>
  );

  if (orderId === null) {
    return frame(
      t.checkout.secureCheckout,
      t.checkout.missingOrderId,
      message(
        'warning',
        t.checkout.missingOrderIdDesc,
        null,
        <>
          <Link href="/account" className={secondaryButton}>
            <Package size={14} aria-hidden />
            {t.checkout.trackOrder}
          </Link>
          {shopLink}
        </>,
      ),
    );
  }

  if (isAuthLoading || !isAuthenticated || phase.kind === 'checking') {
    return frame(
      t.checkout.secureCheckout,
      variant === 'cancel' ? t.checkout.leftPaymentPage : t.checkout.checkingPayment,
      <div role="status" className="flex flex-col items-center gap-4 text-sm text-[#2D1F1F]/50">
        <Loader2 size={28} className="animate-spin text-[#C9A84C]" aria-hidden />
        {t.checkout.checkingPayment}
      </div>,
    );
  }

  if (phase.kind === 'error') {
    const { error } = phase;
    if (error.code === 'not_found' || error.code === 'forbidden') {
      return frame(
        t.checkout.secureCheckout,
        t.checkout.orderNotFound,
        message(
          'warning',
          // The title already says "not found": explain why instead of repeating it.
          error.code === 'not_found' ? t.checkout.orderNotFoundDesc : localizeOrderDetailError(error, t),
          null,
          <>
            <Link href="/account" className={secondaryButton}>
              <Package size={14} aria-hidden />
              {t.checkout.trackOrder}
            </Link>
            {shopLink}
          </>,
        ),
      );
    }
    // Never "payment failed" here: Thawani or the network didn't answer, and
    // the customer may well have paid.
    const text =
      error.reason === 'payment_not_found'
        ? t.checkout.paymentNotFound
        : error.code === 'rate_limited'
          ? t.common.tooManyAttempts
          : t.checkout.paymentCheckFailedDesc;
    return frame(
      t.checkout.secureCheckout,
      t.checkout.paymentCheckFailedTitle,
      message(
        'warning',
        text,
        null,
        <>
          {viewOrderLink(orderId)}
          {error.reason === 'payment_not_found' ? shopLink : checkAgainButton}
        </>,
      ),
    );
  }

  const current = phase.order;
  const state = getOrderPaymentState(current, now);
  const eyebrow = variant === 'cancel' ? t.checkout.leftPaymentPage : t.checkout.secureCheckout;

  switch (state) {
    case 'paid':
      return frame(
        t.checkout.orderPlaced,
        t.checkout.orderConfirmed,
        message(
          'success',
          t.checkout.orderConfirmedDesc,
          orderSummary(current),
          <>
            {viewOrderLink(current.id)}
            {shopLink}
          </>,
        ),
      );
    case 'awaiting_payment':
      // No pay page: the mock gateway, settled by the admin.
      if (!current.payment?.redirectUrl) {
        return frame(
          eyebrow,
          t.checkout.awaitingConfirmationTitle,
          message(
            'waiting',
            t.checkout.awaitingConfirmationDesc,
            orderSummary(current),
            <>
              {viewOrderLink(current.id)}
              {checkAgainButton}
            </>,
            cancelButton(current),
          ),
        );
      }
      return frame(
        eyebrow,
        t.checkout.paymentNotCompleteTitle,
        message(
          'waiting',
          t.checkout.paymentNotCompleteDesc,
          <>
            {orderSummary(current)}
            {countdown(current)}
          </>,
          <>
            {viewOrderLink(current.id)}
            {payButton(current, t.checkout.completePayment, CreditCard)}
          </>,
          cancelButton(current),
        ),
      );
    case 'payment_cancelled_retry':
      return frame(
        eyebrow,
        t.checkout.paymentCancelledTitle,
        message(
          'waiting',
          t.checkout.paymentCancelledDesc,
          <>
            {orderSummary(current)}
            {countdown(current)}
          </>,
          <>
            {viewOrderLink(current.id)}
            {payButton(current, t.checkout.retryPayment, RotateCcw)}
          </>,
          cancelButton(current),
        ),
      );
    case 'payment_window_over':
    case 'failed':
    case 'cancelled_refunded':
    case 'cancelled_unpaid': {
      const copy = {
        payment_window_over: [t.checkout.paymentWindowOverTitle, t.checkout.paymentWindowOverDesc],
        failed: [t.checkout.orderNotPaidTitle, t.checkout.orderNotPaidDesc],
        cancelled_refunded: [t.checkout.orderCancelledTitle, t.checkout.orderCancelledRefundDesc],
        cancelled_unpaid: [t.checkout.orderCancelledTitle, t.checkout.orderCancelledUnpaidDesc],
      }[state];
      // Not paid in time: offer to put its items back in the cart (P9).
      const canOrderAgain = state === 'payment_window_over' || state === 'failed';
      return frame(
        eyebrow,
        copy[0],
        message(
          'closed',
          copy[1],
          // Cancelled here a moment ago: its items are back in the cart.
          cancelledCart && state === 'cancelled_unpaid' ? (
            <>
              {orderSummary(current)}
              <OrderCancelledNotice cart={cancelledCart} className="mt-8" />
            </>
          ) : (
            orderSummary(current)
          ),
          <>
            {viewOrderLink(current.id)}
            {canOrderAgain ? (
              <button
                type="button"
                onClick={() => void orderAgain(current)}
                disabled={orderAgainBusy}
                aria-busy={orderAgainBusy}
                className={primaryButton}
              >
                {orderAgainBusy ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <ShoppingBag size={14} aria-hidden />
                )}
                {t.account.orderAgain}
              </button>
            ) : (
              shopLink
            )}
          </>,
        ),
      );
    }
  }
}
