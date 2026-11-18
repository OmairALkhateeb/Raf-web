'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Gift, Loader2, Package } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import AccountSidebar from '@/components/account/AccountSidebar';
import OrderItemAftercare from '@/components/account/OrderItemAftercare';
import OrderItemPrice from '@/components/account/OrderItemPrice';
import { courierLabel, isDalileeCourier, paymentProviderLabel } from '@/lib/account/shipment-labels';
import { deliveryCityLabel } from '@/lib/account/delivery-cities';
import { useDeliveryZones } from '@/lib/account/useDeliveryZones';
import { confirmOrderPayment, fetchOrder } from '@/lib/api/account';
import { localizeOrderDetailError, localizePaymentError } from '@/lib/account/messages';
import {
  isAccountOrderStatus,
  orderBadge,
  orderStatusPresentation,
  paymentStatusLabel,
  shippingStatusLabel,
} from '@/lib/account/status';
import { getOrderPaymentState } from '@/lib/account/payment-state';
import { useNow } from '@/lib/account/useNow';
import { startPayment } from '@/lib/checkout/start-payment';
import { useOrderAgain } from '@/lib/checkout/useOrderAgain';
import { useCancelOrder } from '@/lib/checkout/useCancelOrder';
import OrderCancelledNotice from '@/components/account/OrderCancelledNotice';
import type { OrderCancelCart } from '@/types/api/account';
import { loginHref } from '@/lib/auth/next-path';
import OrderPaymentActions from '@/components/account/OrderPaymentActions';
import RefundLine from '@/components/account/RefundLine';
import { hasAwaitingTransfer, placeRefunds, refundTotals } from '@/lib/account/refunds';
import { useRefundAccount } from '@/lib/account/useRefundAccount';
import { formatMoney as formatCurrency } from '@/utils/formatPrice';
import type { AccountOrderDetail, AccountOrderItemDetail } from '@/types';
import { AccountPageSkeleton } from '@/components/common/Loading';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

function formatOrderDate(iso: string, language: 'en' | 'ar'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(language === 'ar' ? 'ar-OM' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatMoney(
  amount: number,
  currency: string,
  language: 'en' | 'ar',
  omrLabel: string,
): string {
  return formatCurrency(amount, language, currency, omrLabel);
}

function formatOptions(options: Record<string, string> | null): string | null {
  if (!options) return null;
  const parts = Object.entries(options).map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join(' · ') : null;
}

function formatShipmentDate(iso: string, language: 'en' | 'ar'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(language === 'ar' ? 'ar-OM' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type OrderItemGroup =
  | { kind: 'single'; item: AccountOrderItemDetail }
  | {
      kind: 'bundle';
      bundleId: number;
      name: string | null;
      nameAr: string | null;
      items: AccountOrderItemDetail[];
      total: number;
    };

/** Lines from one bundle (same `product_bundle_id`) together, in order. */
function groupOrderItems(items: AccountOrderItemDetail[]): OrderItemGroup[] {
  const groups: OrderItemGroup[] = [];
  const byBundle = new Map<number, Extract<OrderItemGroup, { kind: 'bundle' }>>();
  for (const item of items) {
    if (item.productBundleId === null) {
      groups.push({ kind: 'single', item });
      continue;
    }
    let group = byBundle.get(item.productBundleId);
    if (!group) {
      group = {
        kind: 'bundle',
        bundleId: item.productBundleId,
        name: item.bundleName,
        nameAr: item.bundleNameAr,
        items: [],
        total: 0,
      };
      byBundle.set(item.productBundleId, group);
      groups.push(group);
    }
    group.items.push(item);
    group.total = Math.round((group.total + item.total) * 1000) / 1000;
  }
  return groups;
}

const DALILEE_TRACKING_URL = 'https://dalilee.om/tracking.html';

/** At most one payment check per this many ms when the tab comes back. */
const PAYMENT_RECHECK_MS = 10_000;

export default function AccountOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { language, t, isRTL } = useLanguage();
  const zones = useDeliveryZones();
  const { showToast } = useApp();
  const { user, isAuthenticated, isAuthLoading, logout } = useAuth();

  const rawId = typeof params.id === 'string' ? params.id : '';
  const orderId =
    /^\d+$/.test(rawId) && Number(rawId) > 0 ? Number(rawId) : null;

  const [order, setOrder] = useState<AccountOrderDetail | null>(null);
  const [loading, setLoading] = useState(orderId !== null);
  const [errorCode, setErrorCode] = useState<
    'not_found' | 'forbidden' | 'unavailable' | 'invalid_input' | null
  >(orderId === null ? 'invalid_input' : null);
  const epochRef = useRef(0);
  // "Complete payment" / "Try again" is running or the browser is leaving.
  const [payBusy, setPayBusy] = useState(false);
  const lastPaymentCheckRef = useRef(0);
  const { orderAgain, busy: orderAgainBusy } = useOrderAgain();
  // The bank account matters only while a refund waits for a transfer (§9.4).
  const { state: bankAccountState } = useRefundAccount(
    order !== null && hasAwaitingTransfer(order.refunds),
  );
  const hasBankAccount =
    bankAccountState.status === 'ready' ? bankAccountState.account !== null : null;
  const signInHref = loginHref(orderId === null ? '/account' : `/account/orders/${orderId}`);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace(signInHref);
    }
  }, [isAuthLoading, isAuthenticated, router, signInHref]);

  /**
   * An unpaid order may have been paid (or its page cancelled) on Thawani
   * since it was loaded: ask the backend to check. Its answer is the whole
   * order (guide §2.2), so it replaces what the page shows. Quiet on errors —
   * the page keeps what it shows.
   */
  const recheckPayment = useCallback(async (id: number) => {
    lastPaymentCheckRef.current = Date.now();
    const epoch = epochRef.current;
    const confirmed = await confirmOrderPayment(id);
    if (confirmed.ok && epoch === epochRef.current) setOrder(confirmed.data);
  }, []);

  const load = useCallback(async () => {
    if (orderId === null) {
      setOrder(null);
      setErrorCode('invalid_input');
      setLoading(false);
      return;
    }

    const epoch = ++epochRef.current;
    setLoading(true);
    setErrorCode(null);

    const result = await fetchOrder(orderId);
    if (epoch !== epochRef.current) return;

    if (!result.ok) {
      if (result.code === 'unauthenticated') {
        await logout();
        router.replace(signInHref);
        return;
      }
      setOrder(null);
      if (
        result.code === 'not_found' ||
        result.code === 'forbidden' ||
        result.code === 'unavailable' ||
        result.code === 'invalid_input'
      ) {
        setErrorCode(result.code);
      } else {
        setErrorCode('unavailable');
      }
      setLoading(false);
      return;
    }
    setOrder(result.data);
    setLoading(false);
  }, [orderId, logout, router, signInHref]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    if (orderId === null) return;
    let cancelled = false;
    void (async () => {
      const epoch = ++epochRef.current;
      const result = await fetchOrder(orderId);
      if (cancelled || epoch !== epochRef.current) return;
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await logout();
          router.replace(signInHref);
          return;
        }
        setOrder(null);
        if (
          result.code === 'not_found' ||
          result.code === 'forbidden' ||
          result.code === 'unavailable' ||
          result.code === 'invalid_input'
        ) {
          setErrorCode(result.code);
        } else {
          setErrorCode('unavailable');
        }
        setLoading(false);
        return;
      }
      setOrder(result.data);
      setErrorCode(null);
      setLoading(false);
      // Loading an unpaid order already asked Thawani (the backend does it,
      // guide §5.4), so coming back to the tab doesn't ask again right away.
      if (result.data.status === 'pending_payment') lastPaymentCheckRef.current = Date.now();
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, orderId, logout, router, signInHref]);

  const unpaidOrderId = order?.status === 'pending_payment' ? order.id : null;

  // Coming back to this tab (or with Back from Thawani, restored from the
  // browser's cache): check an unpaid order again (guide §6.3).
  useEffect(() => {
    if (unpaidOrderId === null) return;
    const recheck = () => {
      if (Date.now() - lastPaymentCheckRef.current < PAYMENT_RECHECK_MS) return;
      void recheckPayment(unpaidOrderId);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setPayBusy(false);
      recheck();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [unpaidOrderId, recheckPayment]);

  // Ticks while the order is unpaid: countdown, and "time over" on time.
  const now = useNow(unpaidOrderId !== null);

  const handleRetry = () => {
    void load();
  };

  const pay = async () => {
    if (!order || payBusy) return;
    setPayBusy(true);
    const result = await startPayment(order);
    if (result.ok && result.redirected) return;
    setPayBusy(false);
    if (result.ok) {
      // Paid meanwhile (or no pay page): show the order as it is now.
      void load();
      return;
    }
    if (result.code === 'unauthenticated') {
      await logout();
      router.replace(signInHref);
      return;
    }
    showToast(localizePaymentError(result, t), 'error');
    if (result.reason === 'payment_closed') void load();
  };

  // "Cancel order": the answer is the cancelled order; say where its items went.
  const [cancelledCart, setCancelledCart] = useState<OrderCancelCart | null>(null);
  const { requestCancel, cancelDialog } = useCancelOrder({
    notice: 'inline',
    onCancelled: ({ order: cancelledOrder, cart }) => {
      epochRef.current += 1;
      setOrder(cancelledOrder);
      setCancelledCart(cart);
    },
    onStale: () => void load(),
  });

  const handleLogout = async () => {
    await logout();
    showToast(t.common.signedOut, 'success');
    router.push('/');
  };

  if (isAuthLoading || !isAuthenticated || !user) {
    return <AccountPageSkeleton label={t.common.loading} />;
  }

  const statusChip = order ? orderBadge(order, now, t.account) : null;
  const paymentState = order ? getOrderPaymentState(order, now) : null;
  // Shipping details only mean something once the order was paid.
  const paidOrder = paymentState === 'paid' || paymentState === 'cancelled_refunded';
  // Refund lines where they belong; totals from them, not `refunded_total`
  // (raised when a store cancels, before a transfer is made).
  const placedRefunds = order ? placeRefunds(order) : null;
  const refundSums = order && order.refunds.length > 0 ? refundTotals(order.refunds) : null;
  const providerName = order?.payment
    ? paymentProviderLabel(order.payment.provider, t.account, {
        label: order.payment.providerLabel,
        labelAr: order.payment.providerLabelAr,
        language,
      })
    : null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.account.title}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.account.orderDetails}
          </h1>
        </div>
      </div>

      <div className={`${cx} py-14 sm:py-20`}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10">
          <AccountSidebar user={user} onLogout={() => void handleLogout()} />

          <div className="space-y-6">
            <Link
              href="/account"
              className="hit-area inline-flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors focus-visible:outline-none focus-visible:underline"
            >
              <ArrowLeft
                size={14}
                className={isRTL ? 'rtl-flip' : undefined}
                aria-hidden
              />
              {t.account.backToOrders}
            </Link>

            {loading ? (
              <div className="border border-[#2D1F1F]/8 rounded-xl py-20 flex justify-center">
                <Loader2
                  size={22}
                  className="animate-spin text-[#C9A84C]"
                  aria-label={t.common.loading}
                />
              </div>
            ) : errorCode ? (
              <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-16 text-center">
                <Package
                  size={32}
                  strokeWidth={1}
                  className="text-[#2D1F1F]/15 mx-auto mb-4"
                />
                <p className="text-sm text-[#2D1F1F]/55 mb-4" role="alert">
                  {errorCode === 'not_found'
                    ? t.account.orderNotFound
                    : errorCode === 'forbidden'
                      ? t.account.orderForbidden
                      : errorCode === 'invalid_input'
                        ? t.account.orderNotFound
                        : t.account.orderUnavailable}
                </p>
                {errorCode === 'unavailable' ? (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="hit-area text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                  >
                    {t.common.retry}
                  </button>
                ) : (
                  <Link
                    href="/account"
                    className="hit-area text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                  >
                    {t.account.backToOrders}
                  </Link>
                )}
              </div>
            ) : order && statusChip ? (
              <>
                <div className="border border-[#2D1F1F]/8 rounded-xl p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <p className="text-lg font-bold text-[#2D1F1F] tracking-wide">
                        {order.orderNumber}
                      </p>
                      <p className="text-xs text-[#2D1F1F]/40 mt-1">
                        {t.account.orderDate}:{' '}
                        {formatOrderDate(order.placedAt, language)}
                      </p>
                    </div>
                    <span
                      className={`self-start px-3 py-1 text-[10px] font-black tracking-[0.12em] uppercase rounded-md ${statusChip.bg} ${statusChip.text}`}
                    >
                      {statusChip.label}
                    </span>
                  </div>

                  <dl
                    className={`mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm ${isRTL ? 'text-right' : ''}`}
                  >
                    <div>
                      <dt className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                        {t.account.paymentStatus}
                      </dt>
                      <dd className="text-[#2D1F1F]">
                        {paymentStatusLabel(order.paymentStatus, t.account)}
                      </dd>
                    </div>
                    {paidOrder ? (
                      <div>
                        <dt className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                          {t.account.shippingStatus}
                        </dt>
                        <dd className="text-[#2D1F1F]">
                          {shippingStatusLabel(order.shippingStatus, t.account)}
                        </dd>
                      </div>
                    ) : null}
                    {providerName ? (
                      <div>
                        <dt className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                          {t.account.paymentProvider}
                        </dt>
                        <dd className="text-[#2D1F1F]">
                          {providerName}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                <OrderPaymentActions
                  order={order}
                  now={now}
                  busy={payBusy}
                  onPay={() => void pay()}
                  variant="panel"
                  orderAgain={{
                    busy: orderAgainBusy,
                    onClick: () => void orderAgain(order),
                  }}
                  onCancel={() => requestCancel(order)}
                  onChangeOrder={() => requestCancel(order, 'change')}
                />

                {cancelledCart && order.status === 'cancelled' ? (
                  <OrderCancelledNotice cart={cancelledCart} />
                ) : null}
                {cancelDialog}

                {placedRefunds && placedRefunds.orderLevel.length > 0 ? (
                  <section
                    aria-labelledby="order-refunds-title"
                    className="border border-[#2D1F1F]/8 rounded-xl px-6 py-5"
                  >
                    <h2
                      id="order-refunds-title"
                      className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-3"
                    >
                      {t.account.refundsTitle}
                    </h2>
                    <div className="space-y-2 text-sm text-start">
                      {placedRefunds.orderLevel.map((refund) => (
                        <RefundLine key={refund.id} refund={refund} hasBankAccount={hasBankAccount} />
                      ))}
                    </div>
                  </section>
                ) : null}

                {order.subOrders.length > 0 ? (
                  <div className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#2D1F1F]/8">
                      <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50">
                        {t.account.shipmentDetails}
                      </h2>
                    </div>
                    <ul>
                      {order.subOrders.map((subOrder, index) => {
                        const shipment = subOrder.shipment;
                        // Sub-orders say "processing" from checkout, before
                        // payment (guide §5.1): name the payment state instead.
                        const subStatusLabel =
                          !paidOrder && subOrder.status !== 'cancelled'
                            ? subOrder.status === 'failed' ||
                              (paymentState !== 'awaiting_payment' && paymentState !== 'payment_cancelled_retry')
                              ? t.account.notPaid
                              : t.account.awaitingPayment
                            : isAccountOrderStatus(subOrder.status)
                              ? orderStatusPresentation(subOrder.status, t.account).label
                              : shippingStatusLabel(subOrder.status, t.account);
                        // "Preparing your shipment" only for a paid part still being prepared.
                        const preparing =
                          paidOrder &&
                          (subOrder.status === 'processing' || subOrder.status === 'ready_to_ship');
                        const subRefunds = placedRefunds?.bySubOrder.get(subOrder.id) ?? [];
                        // The courier couldn't deliver and brought it back (guide §4):
                        // the backend cancels the part with an English reason, so
                        // the store says it in its own words instead.
                        const returnedToSeller = shipment?.status === 'returned';
                        // Orders from before refund lines existed only have the total.
                        const legacyRefunded =
                          order.refunds.length === 0 && subOrder.refundedTotal > 0;
                        return (
                          <li
                            key={subOrder.id}
                            className={`px-6 py-5 ${index < order.subOrders.length - 1 ? 'border-b border-[#2D1F1F]/8' : ''}`}
                          >
                            <div
                              className={`flex flex-wrap items-start justify-between gap-2 ${isRTL ? 'text-right' : ''}`}
                            >
                              <div className="min-w-0">
                                {subOrder.merchantName ? (
                                  <p className="text-sm font-semibold text-[#2D1F1F] break-words">
                                    {subOrder.merchantName}
                                  </p>
                                ) : null}
                                <p className="text-xs text-[#2D1F1F]/45 mt-0.5 break-words">
                                  {t.account.subOrder}: {subOrder.subOrderNumber}
                                </p>
                              </div>
                              <span className="text-[10px] font-black tracking-[0.12em] uppercase text-[#2D1F1F]/50">
                                {subStatusLabel}
                              </span>
                            </div>

                            {(subOrder.status === 'cancelled' &&
                              (subOrder.cancellationReason || legacyRefunded || returnedToSeller)) ||
                            subRefunds.length > 0 ? (
                              <div className="mt-3 space-y-1 rounded-md border border-red-100 bg-red-50/60 px-3 py-2 text-sm text-[#2D1F1F]/75">
                                {returnedToSeller ? (
                                  <p className="break-words">{t.account.returnedRefunded}</p>
                                ) : subOrder.cancellationReason ? (
                                  <p className="break-words">
                                    <span className="font-semibold">
                                      {/* A whole cancelled order may have been cancelled by RAF, not the store. */}
                                      {order.status === 'cancelled'
                                        ? t.account.cancellationReason
                                        : t.account.cancelledBySeller}
                                      :
                                    </span>{' '}
                                    {subOrder.cancellationReason}
                                  </p>
                                ) : null}
                                {subRefunds.map((refund) => (
                                  <RefundLine key={refund.id} refund={refund} hasBankAccount={hasBankAccount} />
                                ))}
                                {legacyRefunded ? (
                                  <p>
                                    {t.account.cancelledRefunded.replace(
                                      '{amount}',
                                      formatMoney(subOrder.refundedTotal, order.currency, language, t.common.omr),
                                    )}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}

                            {shipment === null ? (
                              preparing ? (
                                <p className="text-sm text-[#2D1F1F]/55 mt-4 leading-relaxed">
                                  {t.account.preparingShipment}
                                </p>
                              ) : null
                            ) : (
                              <dl
                                className={`mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm ${isRTL ? 'text-right' : ''}`}
                              >
                                <div>
                                  <dt className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                                    {t.account.shippingStatus}
                                  </dt>
                                  <dd className="text-[#2D1F1F]">
                                    {shippingStatusLabel(
                                      shipment.status,
                                      t.account,
                                    )}
                                    {shipment.status === 'failed_delivery' ? (
                                      <span className="block text-xs text-[#2D1F1F]/55 mt-0.5">
                                        {t.account.failedDeliveryRetry}
                                      </span>
                                    ) : null}
                                  </dd>
                                </div>
                                {courierLabel(shipment.courierName, t.account, {
                                  label: shipment.courierDisplayName,
                                  labelAr: shipment.courierDisplayNameAr,
                                  language,
                                }) ? (
                                  <div>
                                    <dt className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                                      {t.account.courier}
                                    </dt>
                                    <dd className="text-[#2D1F1F] break-words">
                                      {courierLabel(shipment.courierName, t.account, {
                                        label: shipment.courierDisplayName,
                                        labelAr: shipment.courierDisplayNameAr,
                                        language,
                                      })}
                                    </dd>
                                  </div>
                                ) : null}
                                {shipment.trackingNumber ? (
                                  <div className="sm:col-span-2">
                                    <dt className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                                      {t.account.trackingNumber}
                                    </dt>
                                    <dd className="text-[#2D1F1F] font-medium break-all">
                                      {shipment.trackingNumber}
                                    </dd>
                                  </div>
                                ) : null}
                                {shipment.shippedAt ? (
                                  <div>
                                    <dt className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                                      {t.account.shippedAt}
                                    </dt>
                                    <dd className="text-[#2D1F1F]">
                                      {formatShipmentDate(
                                        shipment.shippedAt,
                                        language,
                                      )}
                                    </dd>
                                  </div>
                                ) : null}
                                {shipment.deliveredAt ? (
                                  <div>
                                    <dt className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                                      {t.account.deliveredAt}
                                    </dt>
                                    <dd className="text-[#2D1F1F]">
                                      {formatShipmentDate(
                                        shipment.deliveredAt,
                                        language,
                                      )}
                                    </dd>
                                  </div>
                                ) : null}
                              </dl>
                            )}

                            {/* Dalilee's tracking page only knows Dalilee numbers. */}
                            {shipment?.trackingNumber &&
                            !returnedToSeller &&
                            isDalileeCourier(shipment.courierName) ? (
                              <div className="mt-4 space-y-2">
                                <a
                                  href={DALILEE_TRACKING_URL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 h-11 px-5 border border-[#2D1F1F]/20 rounded-md text-[11px] font-black tracking-[0.2em] uppercase text-[#2D1F1F] hover:border-[#C9A84C] transition-colors"
                                >
                                  <ExternalLink size={13} aria-hidden />
                                  {t.account.trackOnDalilee}
                                </a>
                                <p className="text-xs text-[#2D1F1F]/50 leading-relaxed">
                                  {t.account.dalileeTrackingHint}
                                </p>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                <div className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#2D1F1F]/8">
                    <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50">
                      {t.account.orderItems}
                    </h2>
                  </div>
                  {order.items.length === 0 ? (
                    <p className="px-6 py-10 text-sm text-[#2D1F1F]/40 text-center">
                      {t.account.noOrderItems}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[#2D1F1F]/8">
                      {groupOrderItems(order.items).map((group) => {
                        const renderItem = (item: AccountOrderItemDetail, inBundle: boolean) => {
                          const optionsLabel = formatOptions(item.options);
                          return (
                            <div className="flex gap-4">
                              <div className="relative w-16 h-16 overflow-hidden bg-[#F5F3EF] border border-[#2D1F1F]/8 rounded-md flex-shrink-0">
                                <Image
                                  src={item.imageUrl}
                                  alt={pickLocalized(language, item.productName, item.productNameAr)}
                                  fill
                                  sizes="64px"
                                  className="object-cover"
                                />
                              </div>
                              <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : ''}`}>
                                <p className="text-sm font-semibold text-[#2D1F1F]">
                                  {pickLocalized(language, item.productName, item.productNameAr)}
                                </p>
                                {item.brandName ? (
                                  <p className="text-xs text-[#2D1F1F]/45 mt-0.5">
                                    {pickLocalized(language, item.brandName, item.brandNameAr)}
                                  </p>
                                ) : null}
                                {optionsLabel ? (
                                  <p className="text-xs text-[#2D1F1F]/45 mt-0.5">
                                    {optionsLabel}
                                  </p>
                                ) : null}
                                {item.sku ? (
                                  <p className="text-xs text-[#2D1F1F]/35 mt-0.5">
                                    {t.account.sku}: {item.sku}
                                  </p>
                                ) : null}
                                <p className="text-xs text-[#2D1F1F]/50 mt-2">
                                  {t.account.quantity}: {item.quantity}
                                </p>
                                <OrderItemAftercare
                                  orderId={order.id}
                                  item={item}
                                  currency={order.currency}
                                  refunds={
                                    item.returnRequest
                                      ? (placedRefunds?.byReturn.get(item.returnRequest.id) ?? [])
                                      : []
                                  }
                                  hasBankAccount={hasBankAccount}
                                />
                              </div>
                              {inBundle ? null : (
                                <OrderItemPrice
                                  item={item}
                                  currency={order.currency}
                                />
                              )}
                            </div>
                          );
                        };

                        if (group.kind === 'single') {
                          return (
                            <li key={group.item.id} className="px-6 py-5">
                              {renderItem(group.item, false)}
                            </li>
                          );
                        }

                        // A bundle is split into one line per product; each line's
                        // total is only its share, so show the bundle's total once.
                        return (
                          <li key={`bundle-${group.bundleId}`} className="px-6 py-5">
                            <div className="flex items-center justify-between gap-4 mb-4">
                              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#2D1F1F]">
                                <Gift size={15} className="text-[#C9A84C]" aria-hidden />
                                <span>
                                  <span className="block text-[10px] font-black tracking-[0.15em] uppercase text-[#C9A84C]">
                                    {t.bundles.bundle}
                                  </span>
                                  {group.name
                                    ? pickLocalized(language, group.name, group.nameAr)
                                    : t.bundles.bundle}
                                </span>
                              </p>
                              <span className="text-base sm:text-lg font-bold text-[#2D1F1F] whitespace-nowrap">
                                <bdi>
                                  {formatMoney(group.total, order.currency, language, t.common.omr)}
                                </bdi>
                              </span>
                            </div>
                            <ul className="space-y-4 ps-4 border-s-2 border-[#C9A84C]/30">
                              {group.items.map((item) => (
                                <li key={item.id}>{renderItem(item, true)}</li>
                              ))}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="border border-[#2D1F1F]/8 rounded-xl p-6">
                    <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-4">
                      {t.account.orderSummary}
                    </h2>
                    <dl className="space-y-3 text-sm">
                      <div
                        className="flex justify-between gap-4"
                      >
                        <dt className="text-[#2D1F1F]/50">{t.account.subtotal}</dt>
                        <dd className="font-medium text-[#2D1F1F]">
                          {formatMoney(
                            order.subtotal,
                            order.currency,
                            language,
                            t.common.omr,
                          )}
                        </dd>
                      </div>
                      {order.discountTotal > 0 ? (
                        <div
                          className="flex justify-between gap-4"
                        >
                          <dt className="text-[#2D1F1F]/50">
                            {t.account.discount}
                          </dt>
                          <dd className="font-medium text-[#2D1F1F]">
                            −
                            {formatMoney(
                              order.discountTotal,
                              order.currency,
                              language,
                              t.common.omr,
                            )}
                          </dd>
                        </div>
                      ) : null}
                      <div
                        className="flex justify-between gap-4"
                      >
                        <dt className="text-[#2D1F1F]/50">{t.account.shipping}</dt>
                        <dd className="font-medium text-[#2D1F1F]">
                          {order.shippingTotal === 0
                            ? t.common.free
                            : formatMoney(
                                order.shippingTotal,
                                order.currency,
                                language,
                                t.common.omr,
                              )}
                        </dd>
                      </div>
                      {order.taxTotal > 0 ? (
                        <div
                          className="flex justify-between gap-4"
                        >
                          <dt className="text-[#2D1F1F]/50">{t.account.tax}</dt>
                          <dd className="font-medium text-[#2D1F1F]">
                            {formatMoney(
                              order.taxTotal,
                              order.currency,
                              language,
                              t.common.omr,
                            )}
                          </dd>
                        </div>
                      ) : null}
                      {order.couponCode ? (
                        <div
                          className="flex justify-between gap-4"
                        >
                          <dt className="text-[#2D1F1F]/50">{t.account.coupon}</dt>
                          <dd className="font-medium text-[#2D1F1F]">
                            {order.couponCode}
                          </dd>
                        </div>
                      ) : null}
                      {(refundSums ? refundSums.done : order.refundedTotal) > 0 ? (
                        <div className="flex justify-between gap-4">
                          <dt className="text-emerald-700">
                            {t.account.refunded}
                          </dt>
                          <dd className="font-bold text-emerald-700 whitespace-nowrap">
                            −
                            <bdi>
                              {formatMoney(
                                refundSums ? refundSums.done : order.refundedTotal,
                                order.currency,
                                language,
                                t.common.omr,
                              )}
                            </bdi>
                          </dd>
                        </div>
                      ) : null}
                      {refundSums && refundSums.pending > 0 ? (
                        <div className="flex justify-between gap-4">
                          <dt className="text-amber-800">{t.account.beingRefunded}</dt>
                          <dd className="font-bold text-amber-800 whitespace-nowrap">
                            <bdi>
                              {formatMoney(
                                refundSums.pending,
                                order.currency,
                                language,
                                t.common.omr,
                              )}
                            </bdi>
                          </dd>
                        </div>
                      ) : null}
                      <div
                        className="flex justify-between items-baseline gap-4 pt-3 border-t border-[#2D1F1F]/8"
                      >
                        <dt className="font-bold text-[#2D1F1F]">
                          {t.account.orderTotal}
                        </dt>
                        <dd className="text-lg font-bold text-[#2D1F1F] whitespace-nowrap">
                          {formatMoney(
                            order.grandTotal,
                            order.currency,
                            language,
                            t.common.omr,
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="border border-[#2D1F1F]/8 rounded-xl p-6">
                    <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-4">
                      {t.account.shippingAddress}
                    </h2>
                    {order.shippingAddress ? (
                      <address
                        className={`not-italic text-sm text-[#2D1F1F] leading-relaxed ${isRTL ? 'text-right' : ''}`}
                      >
                        <p className="font-semibold">
                          {order.shippingAddress.name}
                        </p>
                        <p className="text-[#2D1F1F]/55 mt-1">
                          {order.shippingAddress.phone}
                        </p>
                        <p className="mt-3">
                          {order.shippingAddress.addressLine1}
                        </p>
                        {order.shippingAddress.addressLine2 ? (
                          <p>{order.shippingAddress.addressLine2}</p>
                        ) : null}
                        <p>
                          {[
                            order.shippingAddress.area,
                            deliveryCityLabel(order.shippingAddress.city, t, zones, language),
                            order.shippingAddress.postalCode,
                          ]
                            .filter(Boolean)
                            .join(t.common.listSeparator)}
                        </p>
                        <p>{order.shippingAddress.country}</p>
                      </address>
                    ) : (
                      <p className="text-sm text-[#2D1F1F]/40">—</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-16 text-center">
                <p className="text-sm text-[#2D1F1F]/55" role="alert">
                  {localizeOrderDetailError(
                    { ok: false, code: 'unavailable' },
                    t,
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
