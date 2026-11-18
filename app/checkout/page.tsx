'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, CreditCard, Loader2, Lock, MapPin, Package, Tag, X } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import { formatLineOptions } from '@/lib/cart/options';
import { getCartQuote } from '@/lib/api/cart';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import {
  confirmOrderPayment,
  fetchAddresses,
  fetchShippingMethods,
  previewCoupon,
  submitCheckout,
} from '@/lib/api/account';
import { localizeAccountError, localizePaymentError } from '@/lib/account/messages';
import { getOrderPaymentState, isPayableState } from '@/lib/account/payment-state';
import {
  cancelOrderButtonClass,
  changeOrderButtonClass,
  useCancelOrder,
} from '@/lib/checkout/useCancelOrder';
import {
  forgetPendingPayment,
  readPendingPayment,
  rememberPendingPayment,
} from '@/lib/checkout/pending-payment';
import { startPayment } from '@/lib/checkout/start-payment';
import { loginHref } from '@/lib/auth/next-path';
import { isSafeUserFacingError } from '@/lib/auth/error-body';
import { formatMoney } from '@/utils/formatPrice';
import type {
  AccountOrderDetail,
  Address,
  CartTotals,
  CouponPreview,
  ShippingMethodOption,
} from '@/types';
import type { AccountClientError } from '@/types/api/account';
import { formatCustomerAddressParts } from '@/lib/account/formatAddress';
import { useDeliveryZones } from '@/lib/account/useDeliveryZones';
import { StorePageSkeleton } from '@/components/common/Loading';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

/** "about 2 days" / "within 24 hours", from the method's delivery SLA. */
function deliveryEstimate(
  hours: number | null,
  t: ReturnType<typeof useLanguage>['t'],
): string | null {
  if (hours === null || hours <= 0) return null;
  if (hours <= 24) return t.checkout.deliveryWithinHours.replace('{hours}', String(hours));
  return t.checkout.deliveryInDays.replace('{days}', String(Math.ceil(hours / 24)));
}

export default function CheckoutPage() {
  const router = useRouter();
  const {
    items,
    bundles,
    hasLines,
    subtotal,
    currency,
    status: cartStatus,
    refreshCart,
  } = useCart();
  const { language, t, isRTL } = useLanguage();
  const zones = useDeliveryZones();
  const { user, isAuthenticated, isAuthLoading, logout } = useAuth();
  const { showToast } = useApp();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesStatus, setAddressesStatus] = useState<LoadStatus>('loading');
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const [methods, setMethods] = useState<ShippingMethodOption[]>([]);
  const [methodsStatus, setMethodsStatus] = useState<LoadStatus>('idle');
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<CouponPreview | null>(null);
  // The cart priced for an address and method (no coupon), with the subtotal
  // it was priced at; only used while all three still match (`quote` below).
  const [quoteResult, setQuoteResult] = useState<{ totals: CartTotals; subtotal: number } | null>(null);
  const quoteEpochRef = useRef(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once the order exists, so the emptied cart doesn't flash "Your cart
  // is empty" while the browser leaves for Thawani.
  const [placedOrderId, setPlacedOrderId] = useState<number | null>(null);
  // An order this tab was sent to Thawani for and that is still unpaid
  // (after the browser's Back button): offer to finish paying it.
  const [pendingOrder, setPendingOrder] = useState<AccountOrderDetail | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const submitLockRef = useRef(false);
  const addressesEpochRef = useRef(0);
  const methodsEpochRef = useRef(0);
  const previewEpochRef = useRef(0);
  // What the last preview was for, so re-renders don't repeat the same call.
  const lastPreviewKeyRef = useRef<string | null>(null);
  // Scrolled to when checkout says we don't deliver to the chosen address.
  const addressSectionRef = useRef<HTMLElement | null>(null);

  const handleAuthFailure = useCallback(async () => {
    await logout();
    router.replace(loginHref('/checkout'));
  }, [logout, router]);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace(loginHref('/checkout'));
    }
  }, [isAuthLoading, isAuthenticated, router]);

  // Is the order this tab last sent to Thawani still waiting for payment?
  // Confirm (not just load) it: it may have been paid before coming back.
  const loadPendingOrder = useCallback(async () => {
    const pending = readPendingPayment();
    if (!pending) {
      setPendingOrder(null);
      return;
    }
    const result = await confirmOrderPayment(pending.orderId);
    if (!result.ok) {
      setPendingOrder(null);
      if (result.code === 'not_found' || result.code === 'forbidden') forgetPendingPayment();
      return;
    }
    if (isPayableState(getOrderPaymentState(result.data, Date.now()))) {
      setPendingOrder(result.data);
    } else {
      forgetPendingPayment();
      setPendingOrder(null);
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    void (async () => {
      await loadPendingOrder();
    })();
  }, [isAuthLoading, isAuthenticated, loadPendingOrder]);

  // Back from Thawani can restore this page from the browser's cache, still
  // showing "Taking you to secure payment…": reset it and reload the cart.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setPlacedOrderId(null);
      setIsSubmitting(false);
      setPendingBusy(false);
      submitLockRef.current = false;
      void refreshCart();
      void loadPendingOrder();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [refreshCart, loadPendingOrder]);

  const payPendingOrder = async () => {
    if (!pendingOrder || pendingBusy) return;
    setPendingBusy(true);
    const result = await startPayment(pendingOrder);
    if (result.ok && result.redirected) return;
    setPendingBusy(false);
    if (result.ok) {
      // Paid meanwhile (or no pay page): its order page says which.
      forgetPendingPayment();
      router.push(`/account/orders/${result.order.id}`);
      return;
    }
    if (result.code === 'unauthenticated') {
      await handleAuthFailure();
      return;
    }
    showToast(localizePaymentError(result, t), 'error');
    if (result.reason === 'payment_closed') {
      forgetPendingPayment();
      setPendingOrder(null);
    }
  };

  // "Cancel order" on the waiting order: its items come back into the cart,
  // so this page shows them again ready to change (guide §5.3-b).
  const { requestCancel, cancelDialog } = useCancelOrder({
    notice: 'toast',
    onCancelled: () => setPendingOrder(null),
    onStale: () => void loadPendingOrder(),
  });

  const loadAddresses = useCallback(async () => {
    const epoch = ++addressesEpochRef.current;
    setAddressesStatus('loading');
    const result = await fetchAddresses();
    if (epoch !== addressesEpochRef.current) return;

    if (!result.ok) {
      if (result.code === 'unauthenticated') {
        await handleAuthFailure();
        return;
      }
      setAddresses([]);
      setSelectedAddressId(null);
      setAddressesStatus('unavailable');
      return;
    }

    setAddresses(result.data);
    const preferred =
      result.data.find((a) => a.isDefault) ?? result.data[0] ?? null;
    setSelectedAddressId(preferred ? Number(preferred.id) : null);
    setAddressesStatus('ready');
  }, [handleAuthFailure]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    void (async () => {
      await loadAddresses();
    })();
  }, [isAuthLoading, isAuthenticated, loadAddresses]);

  // Fees depend on the address's zone AND the cart total, so reload whenever
  // either changes.
  const loadMethods = useCallback(
    async (addressId: number) => {
      const epoch = ++methodsEpochRef.current;
      setMethodsStatus('loading');
      const result = await fetchShippingMethods(addressId);
      if (epoch !== methodsEpochRef.current) return;

      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await handleAuthFailure();
          return;
        }
        setMethods([]);
        setSelectedMethodId(null);
        setMethodsStatus('unavailable');
        return;
      }

      // `available`, not `zoneAvailable`: a zone may not offer every method.
      const available = result.data.filter((m) => m.available);
      setMethods(result.data);
      setSelectedMethodId((current) =>
        current !== null && available.some((m) => m.id === current)
          ? current
          : (available[0]?.id ?? null),
      );
      setMethodsStatus('ready');
    },
    [handleAuthFailure],
  );

  useEffect(() => {
    if (selectedAddressId === null || cartStatus !== 'ready') return;
    void (async () => {
      await loadMethods(selectedAddressId);
    })();
  }, [selectedAddressId, subtotal, cartStatus, loadMethods]);

  // Exact totals (shipping + tax) for the chosen address and method, the same
  // numbers checkout will charge. Reloaded when either or the cart changes.
  useEffect(() => {
    const epoch = ++quoteEpochRef.current;
    if (selectedAddressId === null || selectedMethodId === null || cartStatus !== 'ready') return;
    const addressId = selectedAddressId;
    const methodId = selectedMethodId;
    void (async () => {
      const result = await getCartQuote(addressId, methodId);
      if (epoch !== quoteEpochRef.current) return;
      setQuoteResult(
        result.ok && result.cart.totals
          ? { totals: result.cart.totals, subtotal: result.cart.subtotal }
          : null,
      );
    })();
  }, [selectedAddressId, selectedMethodId, subtotal, cartStatus]);

  // A quote for another address, method or cart is never shown.
  const quote =
    quoteResult &&
    cartStatus === 'ready' &&
    quoteResult.subtotal === subtotal &&
    quoteResult.totals.shippingAddressId === selectedAddressId &&
    quoteResult.totals.shippingMethodId === selectedMethodId
      ? quoteResult.totals
      : null;

  const runPreview = useCallback(
    async (code: string) => {
      const epoch = ++previewEpochRef.current;
      lastPreviewKeyRef.current = [
        code.toLowerCase(),
        selectedAddressId,
        selectedMethodId,
        subtotal,
      ].join('|');
      setCouponLoading(true);
      setCouponError(null);
      const result = await previewCoupon({
        couponCode: code,
        addressId: selectedAddressId,
        shippingMethodId: selectedMethodId,
      });
      if (epoch !== previewEpochRef.current) return false;
      setCouponLoading(false);

      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await handleAuthFailure();
          return false;
        }
        setPreview(null);
        setAppliedCode(null);
        lastPreviewKeyRef.current = null;
        // The backend's reason (expired, minimum order…) comes in the UI
        // language; show it when it's a safe message.
        setCouponError(
          result.code === 'validation' &&
            result.error &&
            isSafeUserFacingError(result.error)
            ? result.error
            : result.code === 'validation' || result.code === 'invalid_input'
              ? t.checkout.couponInvalid
              : t.common.serviceUnavailable,
        );
        return false;
      }
      setPreview(result.data);
      setAppliedCode(result.data.couponCode);
      return true;
    },
    [handleAuthFailure, selectedAddressId, selectedMethodId, subtotal, t],
  );

  // An applied coupon's totals depend on the cart, address and method.
  useEffect(() => {
    if (!appliedCode || cartStatus !== 'ready') return;
    const key = [
      appliedCode.toLowerCase(),
      selectedAddressId,
      selectedMethodId,
      subtotal,
    ].join('|');
    if (key === lastPreviewKeyRef.current) return;
    void (async () => {
      await runPreview(appliedCode);
    })();
    // runPreview changes with the address/method; subtotal covers the cart.
  }, [appliedCode, runPreview, subtotal, cartStatus, selectedAddressId, selectedMethodId]);

  const applyCoupon = async () => {
    const code = couponInput.trim().slice(0, 50);
    if (!code) {
      setCouponError(t.checkout.couponRequired);
      return;
    }
    await runPreview(code);
  };

  const removeCoupon = () => {
    previewEpochRef.current += 1;
    lastPreviewKeyRef.current = null;
    setAppliedCode(null);
    setPreview(null);
    setCouponError(null);
    setCouponInput('');
    setCouponLoading(false);
  };

  const money = (amount: number) =>
    formatMoney(amount, language, currency, t.common.omr);

  const selectedMethod =
    methods.find((m) => m.id === selectedMethodId && m.available) ?? null;
  const noDelivery =
    methodsStatus === 'ready' && !methods.some((m) => m.available);
  // `false` when the cart quote or the coupon preview says checkout would
  // refuse this address/method (guide §2.2): its shipping of 0 isn't free.
  const shippingAvailable =
    preview?.shippingAvailable ?? quote?.shippingAvailable ?? null;
  const shippingBlocked = shippingAvailable === false;
  const typedButNotApplied =
    couponInput.trim() !== '' &&
    couponInput.trim().toLowerCase() !== (appliedCode ?? '').toLowerCase();

  const canSubmit =
    !isAuthLoading &&
    isAuthenticated &&
    selectedAddressId !== null &&
    selectedAddressId > 0 &&
    selectedMethod !== null &&
    !shippingBlocked &&
    hasLines &&
    cartStatus === 'ready' &&
    !couponLoading &&
    !isSubmitting;

  // Summary: exact totals from the coupon preview when there is one, else
  // from the cart priced for this address and method; failing both,
  // subtotal + the chosen method's fee (tax unknown).
  const shippingFee =
    preview?.shippingTotal ?? quote?.shippingTotal ?? selectedMethod?.price ?? null;
  const discount = preview?.discountTotal ?? 0;
  const taxTotal = preview ? preview.taxTotal : (quote?.taxTotal ?? null);
  const exactTotal = preview?.grandTotal ?? quote?.grandTotal ?? null;
  const estimatedTotal =
    shippingFee !== null ? subtotal - discount + shippingFee : null;

  /** A failed checkout, by the backend's `code` (guide §13). Nothing was ordered. */
  const handleCheckoutError = async (error: AccountClientError) => {
    if (error.code === 'unauthenticated') {
      await handleAuthFailure();
      return;
    }
    const backendMessage =
      error.error && isSafeUserFacingError(error.error) ? error.error : null;
    switch (error.reason) {
      case 'provider_unavailable':
        // The same button tries again, with the same key.
        showToast(t.checkout.paymentProviderUnavailable, 'error');
        return;
      case 'cart_empty':
        showToast(backendMessage ?? t.checkout.emptyCart, 'error');
        void refreshCart();
        return;
      case 'cart_items':
        // The cart page shows which line has the problem.
        showToast(backendMessage ?? t.cart.checkoutUnavailable, 'error');
        void refreshCart();
        router.push('/cart');
        return;
      // Refused before any order or payment (guide §2.3): reload the methods
      // for this address so the page offers only what can be delivered.
      case 'address_not_deliverable':
        showToast(backendMessage ?? t.checkout.noDeliveryToAddress, 'error');
        if (selectedAddressId !== null) void loadMethods(selectedAddressId);
        addressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      case 'shipping_method_unavailable':
        showToast(backendMessage ?? t.checkout.methodUnavailableHint, 'error');
        if (selectedAddressId !== null) void loadMethods(selectedAddressId);
        return;
      case 'coupon':
        previewEpochRef.current += 1;
        lastPreviewKeyRef.current = null;
        setAppliedCode(null);
        setPreview(null);
        setCouponError(backendMessage ?? t.checkout.couponInvalid);
        return;
    }
    showToast(backendMessage ?? localizeAccountError(error, t), 'error');
  };

  const placeOrder = async () => {
    if (!canSubmit || selectedMethod === null || selectedAddressId === null) {
      return;
    }
    if (isSubmitting || submitLockRef.current) return;

    // A typed coupon must be checked first, so the customer sees its effect.
    if (typedButNotApplied) {
      await applyCoupon();
      return;
    }

    submitLockRef.current = true;
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    setIsSubmitting(true);

    try {
      const input = {
        addressId: selectedAddressId,
        shippingMethodId: selectedMethod.id,
        couponCode: appliedCode,
      };
      // One key per attempt, reused after a network error or when Thawani was
      // unreachable, so a repeat never makes a second order.
      let result = await submitCheckout({ ...input, idempotencyKey: idempotencyKeyRef.current });
      if (!result.ok && result.reason === 'key_used') {
        // The key belongs to another account: a new one, sent once more.
        idempotencyKeyRef.current = crypto.randomUUID();
        result = await submitCheckout({ ...input, idempotencyKey: idempotencyKeyRef.current });
      }

      if (!result.ok) {
        await handleCheckoutError(result);
        return;
      }

      idempotencyKeyRef.current = null;
      const order = result.data;
      setPlacedOrderId(order.id);
      // The backend converts the cart into the order and starts a new empty
      // one; reload it so the header badge drops to 0.
      void refreshCart();
      const payUrl = order.payment?.redirectUrl ?? null;
      if (payUrl) {
        // Same tab: Thawani and bank 3-D Secure pages don't work in a popup
        // or iframe. Thawani sends the customer back to /checkout/success or
        // /checkout/cancel, which confirm the payment.
        rememberPendingPayment({ orderId: order.id, orderNumber: order.orderNumber });
        window.location.assign(payUrl);
        return;
      }
      // No pay page (the mock gateway): the order waits for the admin.
      router.replace(`/account/orders/${order.id}`);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || !isAuthenticated || !user) {
    return <StorePageSkeleton label={t.common.loading} />;
  }

  if (placedOrderId !== null) {
    return (
      <div className={`${cx} py-32 flex flex-col items-center gap-4 text-center`} role="status">
        <Loader2 size={24} className="animate-spin text-[#C9A84C]" aria-hidden />
        <p className="text-[#2D1F1F]/50 text-sm">{t.checkout.redirectingToPayment}</p>
      </div>
    );
  }

  const pendingNotice = pendingOrder ? (
    <div
      role="status"
      className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <Clock size={20} className="text-amber-700 flex-shrink-0" aria-hidden />
      <div className="flex-1 min-w-0 text-start">
        <p className="text-sm font-bold text-[#2D1F1F]">
          {t.checkout.pendingPaymentNotice.replace('{number}', pendingOrder.orderNumber)}
        </p>
        <p className="text-xs text-[#2D1F1F]/60 mt-1">{t.checkout.pendingPaymentNoticeDesc}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <button
            type="button"
            onClick={() => requestCancel(pendingOrder, 'change')}
            disabled={pendingBusy}
            className={changeOrderButtonClass}
          >
            {t.checkout.changeOrder}
          </button>
          <button
            type="button"
            onClick={() => requestCancel(pendingOrder)}
            disabled={pendingBusy}
            className={cancelOrderButtonClass}
          >
            {t.checkout.cancelOrder}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 flex-shrink-0">
        <Link
          href={`/account/orders/${pendingOrder.id}`}
          className="h-10 px-4 border border-[#2D1F1F]/20 rounded-md text-[#2D1F1F] text-[10px] font-black tracking-[0.15em] uppercase flex items-center gap-2 hover:bg-[#2D1F1F] hover:text-white transition-colors"
        >
          <Package size={13} aria-hidden />
          {t.checkout.viewOrder}
        </Link>
        <button
          type="button"
          onClick={() => void payPendingOrder()}
          disabled={pendingBusy}
          aria-busy={pendingBusy}
          className="h-10 px-4 bg-[#C9A84C] text-[#2D1F1F] text-[10px] font-black tracking-[0.15em] uppercase rounded-md flex items-center gap-2 hover:bg-[#2D1F1F] hover:text-white transition-colors disabled:opacity-60"
        >
          {pendingBusy ? (
            <Loader2 size={13} className="animate-spin" aria-hidden />
          ) : (
            <CreditCard size={13} aria-hidden />
          )}
          {t.checkout.completePayment}
        </button>
      </div>
      {cancelDialog}
    </div>
  ) : null;

  if (cartStatus === 'loading') {
    return <StorePageSkeleton label={t.common.loading} />;
  }

  if (cartStatus === 'unavailable') {
    return (
      <div className={`${cx} py-32 text-center`}>
        <p className="text-[#2D1F1F]/40 text-sm mb-6">
          {t.cart.checkoutUnavailable}
        </p>
        <Link
          href="/cart"
          className="text-[10px] font-black tracking-[0.25em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
        >
          {t.checkout.backToCart}
        </Link>
      </div>
    );
  }

  if (!hasLines) {
    return (
      <div className={`${cx} py-32 text-center`}>
        {pendingNotice ? <div className="max-w-2xl mx-auto">{pendingNotice}</div> : null}
        <p className="text-[#2D1F1F]/40 text-sm mb-6">{t.checkout.emptyCart}</p>
        <Link
          href="/products"
          className="text-[10px] font-black tracking-[0.25em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
        >
          {t.checkout.continueShopping}
        </Link>
      </div>
    );
  }

  const submitHint =
    selectedAddressId === null
      ? t.checkout.selectAddressFirst
      : noDelivery
        ? t.checkout.noDeliveryToAddress
        : shippingBlocked
          ? t.checkout.methodUnavailableHint
          : selectedMethod === null && methodsStatus !== 'loading'
            ? t.checkout.placeOrderDisabledHint
            : null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.checkout.secureCheckout}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.checkout.title}
          </h1>
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        {pendingNotice}
        <div className="grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-16">
          <div className="space-y-6 min-w-0">
            <section className="border border-[#2D1F1F]/8 rounded-xl p-6 sm:p-8">
              <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-6">
                {t.checkout.contactInfo}
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <dt className="text-[#2D1F1F]/45">{t.checkout.fullName}</dt>
                  <dd className="font-medium text-[#2D1F1F] break-words">
                    {user.name}
                  </dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <dt className="text-[#2D1F1F]/45">{t.checkout.email}</dt>
                  <dd className="font-medium text-[#2D1F1F] break-all">
                    {user.email}
                  </dd>
                </div>
                {user.phone ? (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                    <dt className="text-[#2D1F1F]/45">{t.checkout.phone}</dt>
                    <dd className="font-medium text-[#2D1F1F]">{user.phone}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section
              ref={addressSectionRef}
              className="border border-[#2D1F1F]/8 rounded-xl p-6 sm:p-8 scroll-mt-24"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50">
                  {t.checkout.shippingAddress}
                </h2>
                <Link
                  href="/account"
                  className="hit-area text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                >
                  {addresses.length === 0
                    ? t.checkout.addAddress
                    : t.checkout.manageAddresses}
                </Link>
              </div>

              {addressesStatus === 'loading' ? (
                <p className="text-sm text-[#2D1F1F]/40">
                  {t.checkout.loadingAddresses}
                </p>
              ) : addressesStatus === 'unavailable' ? (
                <p className="text-sm text-[#2D1F1F]/50">
                  {t.checkout.addressesUnavailable}
                </p>
              ) : addresses.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-[#2D1F1F]/50 leading-relaxed">
                    {t.checkout.noAddresses}
                  </p>
                  <Link
                    href="/account"
                    className="inline-flex items-center gap-2 h-11 px-5 border border-[#2D1F1F]/20 rounded-md text-[11px] font-black tracking-[0.2em] uppercase text-[#2D1F1F] hover:border-[#C9A84C] transition-colors"
                  >
                    <MapPin size={14} />
                    {t.checkout.addAddress}
                  </Link>
                </div>
              ) : (
                <fieldset className="space-y-3">
                  <legend className="sr-only">{t.checkout.selectAddress}</legend>
                  {addresses.map((addr) => {
                    const idNum = Number(addr.id);
                    const selected = selectedAddressId === idNum;
                    return (
                      <label
                        key={addr.id}
                        className={`flex gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all min-w-0 ${
                          selected
                            ? 'border-[#C9A84C] bg-[#C9A84C]/5'
                            : 'border-[#2D1F1F]/12 hover:border-[#2D1F1F]/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="checkout-address"
                          className="mt-1 accent-[#C9A84C] flex-shrink-0"
                          checked={selected}
                          onChange={() => setSelectedAddressId(idNum)}
                        />
                        <span className="min-w-0 flex-1 text-sm text-[#2D1F1F]">
                          <span className="font-medium block break-words">
                            {addr.label || addr.fullName}
                            {addr.isDefault ? (
                              <span className="ms-2 text-[10px] font-black tracking-wider uppercase text-[#C9A84C]">
                                {t.checkout.defaultAddress}
                              </span>
                            ) : null}
                          </span>
                          <span className="block text-[#2D1F1F]/55 mt-1 break-words">
                            {addr.fullName} · {addr.phone}
                          </span>
                          <span className="block text-[#2D1F1F]/55 mt-0.5 break-words">
                            {formatCustomerAddressParts(addr, t, zones, language).join(
                              t.common.listSeparator,
                            )}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </section>

            <section className="border border-[#2D1F1F]/8 rounded-xl p-6 sm:p-8">
              <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-4">
                {t.checkout.shippingMethod}
              </h2>
              {selectedAddressId === null ? (
                <p className="text-sm text-[#2D1F1F]/55">
                  {t.checkout.selectAddressFirst}
                </p>
              ) : methodsStatus === 'loading' || methodsStatus === 'idle' ? (
                <p className="text-sm text-[#2D1F1F]/40 inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  {t.checkout.shippingMethodsLoading}
                </p>
              ) : methodsStatus === 'unavailable' ? (
                <div className="text-sm text-[#2D1F1F]/55 space-y-2">
                  <p role="alert">{t.checkout.shippingUnavailable}</p>
                  <button
                    type="button"
                    onClick={() => void loadMethods(selectedAddressId)}
                    className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F]"
                  >
                    {t.common.retry}
                  </button>
                </div>
              ) : noDelivery ? (
                <p className="text-sm text-amber-700 leading-relaxed" role="alert">
                  {t.checkout.noDeliveryToAddress}
                </p>
              ) : (
                <fieldset className="space-y-3">
                  <legend className="sr-only">{t.checkout.shippingMethod}</legend>
                  {/* A method the address's zone doesn't offer stays listed but
                      can't be chosen, and never shows a price or "Free"
                      (guide §2.1). */}
                  {methods
                    .filter((m) => m.zoneAvailable)
                    .map((method) => {
                      const offered = method.available;
                      const selected = offered && method.id === selectedMethodId;
                      const description = method.description
                        ? pickLocalized(language, method.description, method.descriptionAr)
                        : null;
                      const eta = deliveryEstimate(method.durationHours, t);
                      return (
                        <label
                          key={method.id}
                          aria-disabled={!offered || undefined}
                          className={`flex items-start gap-3 p-4 border-2 rounded-lg transition-all ${
                            !offered
                              ? 'border-[#2D1F1F]/8 bg-[#2D1F1F]/[0.02] opacity-60 cursor-not-allowed'
                              : selected
                                ? 'border-[#C9A84C] bg-[#C9A84C]/5 cursor-pointer'
                                : 'border-[#2D1F1F]/12 hover:border-[#2D1F1F]/30 cursor-pointer'
                          }`}
                        >
                          <input
                            type="radio"
                            name="checkout-shipping-method"
                            className="mt-1 accent-[#C9A84C] flex-shrink-0"
                            checked={selected}
                            disabled={!offered}
                            onChange={() => {
                              if (offered) setSelectedMethodId(method.id);
                            }}
                          />
                          <span className="flex-1 min-w-0 text-sm">
                            <span className="block font-medium text-[#2D1F1F]">
                              {pickLocalized(language, method.name, method.nameAr)}
                            </span>
                            {eta ? (
                              <span className="block text-xs text-[#2D1F1F]/50 mt-0.5">
                                {eta}
                              </span>
                            ) : null}
                            {description ? (
                              <span className="block text-xs text-[#2D1F1F]/45 mt-0.5">
                                {description}
                              </span>
                            ) : null}
                            {!offered ? (
                              <span className="block text-xs text-amber-700 mt-0.5">
                                {t.checkout.methodUnavailable}
                              </span>
                            ) : null}
                            {offered && method.freeShippingThreshold !== null && method.price !== null && method.price > 0 ? (
                              <span className="block text-xs text-emerald-700 mt-0.5">
                                {t.checkout.freeOver.replace('{amount}', money(method.freeShippingThreshold))}
                                {method.freeShippingThreshold > subtotal
                                  ? ` · ${t.checkout.freeDeliveryRemaining.replace('{amount}', money(method.freeShippingThreshold - subtotal))}`
                                  : ''}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={`text-sm font-bold whitespace-nowrap ${
                              offered && method.price === 0 ? 'text-emerald-700' : 'text-[#2D1F1F]'
                            }`}
                          >
                            {!offered || method.price === null
                              ? '—'
                              : method.price === 0
                                ? t.common.free
                                : money(method.price)}
                          </span>
                        </label>
                      );
                    })}
                </fieldset>
              )}
            </section>

            <section className="border border-[#2D1F1F]/8 rounded-xl p-6 sm:p-8">
              <label
                htmlFor="checkout-coupon"
                className="block text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-2"
              >
                {t.checkout.couponOptional}
              </label>
              {preview ? (
                <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-emerald-50 text-emerald-800">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Tag size={14} aria-hidden />
                    {t.checkout.couponApplied.replace('{code}', preview.couponCode)}
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="inline-flex items-center gap-1 text-[10px] font-black tracking-[0.2em] uppercase hover:text-[#2D1F1F]"
                  >
                    <X size={12} aria-hidden />
                    {t.checkout.couponRemove}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[#2D1F1F]/45 mb-3 leading-relaxed">
                    {t.checkout.couponHint}
                  </p>
                  <div className="flex gap-2">
                    <input
                      id="checkout-coupon"
                      type="text"
                      maxLength={50}
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.slice(0, 50));
                        setCouponError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void applyCoupon();
                        }
                      }}
                      placeholder={t.checkout.couponPlaceholder}
                      autoComplete="off"
                      dir="ltr"
                      aria-invalid={couponError ? true : undefined}
                      aria-describedby={couponError ? 'checkout-coupon-error' : undefined}
                      className="flex-1 min-w-0 h-11 px-4 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => void applyCoupon()}
                      disabled={couponLoading}
                      className="h-11 px-5 border border-[#2D1F1F]/20 rounded-md text-[11px] font-black tracking-[0.2em] uppercase text-[#2D1F1F] hover:border-[#C9A84C] transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {couponLoading ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden />
                      ) : null}
                      {t.checkout.couponApply}
                    </button>
                  </div>
                </>
              )}
              {couponError ? (
                <p
                  id="checkout-coupon-error"
                  className="mt-2 text-xs text-red-600"
                  role="alert"
                >
                  {couponError}
                </p>
              ) : null}
            </section>

            <p className="text-xs text-[#2D1F1F]/45 leading-relaxed">
              {t.checkout.paymentHandledLater}
            </p>

            <div>
              <button
                type="button"
                disabled={!canSubmit}
                aria-disabled={!canSubmit}
                aria-busy={isSubmitting}
                onClick={() => {
                  void placeOrder();
                }}
                className={`w-full h-12 text-[11px] font-black tracking-[0.25em] uppercase flex items-center justify-center gap-2.5 rounded-md transition-colors ${
                  canSubmit
                    ? 'bg-[#C9A84C] text-[#2D1F1F] hover:bg-[#2D1F1F] hover:text-white'
                    : 'bg-[#C9A84C]/40 text-[#2D1F1F] cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                    {t.checkout.placingOrder}
                  </>
                ) : (
                  <>
                    <Lock size={13} />
                    {t.checkout.placeOrder}
                  </>
                )}
              </button>
              {submitHint ? (
                <p className="text-xs text-[#2D1F1F]/50 mt-3 leading-relaxed">
                  {submitHint}
                </p>
              ) : null}
            </div>
          </div>

          <aside className="min-w-0">
            <div className="border border-[#2D1F1F]/8 rounded-xl p-6 sticky top-24">
              <h3 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-6">
                {t.cart.orderSummary}
              </h3>

              <ul className="space-y-4 mb-6 pb-6 border-b border-[#2D1F1F]/8">
                {items.map((item) => (
                  <li
                    key={item.itemId}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <div className="relative w-14 h-14 overflow-hidden bg-[#F5F3EF] rounded-md flex-shrink-0">
                      <Image
                        src={item.imageUrl}
                        alt={pickLocalized(language, item.name, item.nameAr)}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#2D1F1F] line-clamp-2 break-words">
                        {pickLocalized(language, item.name, item.nameAr)}
                      </p>
                      {formatLineOptions(item.options) && (
                        <p className="text-xs text-[#2D1F1F]/50 mt-0.5" dir="auto">
                          {formatLineOptions(item.options)}
                        </p>
                      )}
                      <p className="text-xs text-[#2D1F1F]/40 mt-0.5">
                        {t.cart.quantity}: {item.quantity}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[#2D1F1F] flex-shrink-0">
                      {money(item.lineTotal)}
                    </span>
                  </li>
                ))}
                {bundles.map((line) => (
                  <li
                    key={`bundle-${line.bundleItemId}`}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <div className="relative w-14 h-14 overflow-hidden bg-[#F5F3EF] rounded-md flex-shrink-0">
                      <Image
                        src={line.imageUrl}
                        alt={pickLocalized(language, line.name, line.nameAr)}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black tracking-[0.15em] uppercase text-[#C9A84C]">
                        {t.bundles.bundle}
                      </p>
                      <p className="text-sm font-medium text-[#2D1F1F] line-clamp-2 break-words">
                        {pickLocalized(language, line.name, line.nameAr)}
                      </p>
                      <p className="text-xs text-[#2D1F1F]/40 mt-0.5">
                        {t.cart.quantity}: {line.quantity}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[#2D1F1F] flex-shrink-0">
                      {money(line.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#2D1F1F]/50">{t.cart.subtotal}</dt>
                  <dd className="font-medium text-[#2D1F1F]">{money(subtotal)}</dd>
                </div>
                {discount > 0 ? (
                  <div className="flex justify-between gap-4 text-emerald-700">
                    <dt>{t.account.discount}</dt>
                    <dd className="font-semibold">−{money(discount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-[#2D1F1F]/50">{t.cart.shipping}</dt>
                  <dd
                    className={`font-medium text-end ${shippingBlocked ? 'text-amber-700' : 'text-[#2D1F1F]'}`}
                  >
                    {shippingBlocked
                      ? t.checkout.methodUnavailable
                      : shippingFee === null
                        ? '—'
                        : shippingFee === 0
                          ? t.common.free
                          : money(shippingFee)}
                  </dd>
                </div>
                {taxTotal ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#2D1F1F]/50">
                      {!preview && quote && quote.taxRate > 0
                        ? t.cart.vat.replace('{rate}', String(quote.taxRate))
                        : t.account.tax}
                    </dt>
                    <dd className="font-medium text-[#2D1F1F]">
                      {money(taxTotal)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between items-baseline gap-4 pt-3 border-t border-[#2D1F1F]/8">
                  <dt className="font-bold text-[#2D1F1F]">
                    {exactTotal !== null ? t.cart.total : t.checkout.estimatedTotal}
                  </dt>
                  <dd className="text-lg font-bold text-[#2D1F1F] whitespace-nowrap">
                    {exactTotal !== null
                      ? money(exactTotal)
                      : estimatedTotal !== null
                        ? money(estimatedTotal)
                        : '—'}
                  </dd>
                </div>
              </dl>
              {exactTotal === null ? (
                <p className="text-xs text-[#2D1F1F]/45 mt-4 leading-relaxed">
                  {t.checkout.taxNote}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
