'use client';

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cancelOrder } from '@/lib/api/account';
import { localizePaymentError } from '@/lib/account/messages';
import { loginHref } from '@/lib/auth/next-path';
import { forgetPendingPayment, readPendingPayment } from '@/lib/checkout/pending-payment';
import { orderCancelledMessage } from '@/components/account/OrderCancelledNotice';
import type { AccountOrderDetail } from '@/types';
import type { OrderCancelCart } from '@/types/api/account';

export type CancelledOrder = { order: AccountOrderDetail; cart: OrderCancelCart };

/** `change`: the same cancel, then the cart opens to change the order (guide §5.3-b). */
type Mode = 'cancel' | 'change';

type Target = { id: number; orderNumber: string; mode: Mode };

/**
 * "Cancel order" for an order that isn't paid yet (guide §4.6 A and B,
 * §5.3-b). It asks first; the backend then cancels the order, releases its
 * stock and coupon, and puts its lines back in the cart.
 *
 * - `notice: 'toast'` says what happened in a toast (My Orders, checkout);
 *   `'inline'` leaves it to the page (`OrderCancelledNotice`).
 * - `onStale`: the order was paid, closed or cancelled meanwhile — reload it.
 * - `requestCancel(order, 'change')` is "Change order": after the cancel the
 *   cart page opens, so the items, address or coupon can be changed.
 */
export function useCancelOrder({
  notice,
  onCancelled,
  onStale,
}: {
  notice: 'toast' | 'inline';
  onCancelled: (result: CancelledOrder) => void;
  onStale?: () => void;
}) {
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { logout } = useAuth();
  const { refreshCart } = useCart();
  const { showToast } = useApp();
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCancel = useCallback(
    (order: { id: number; orderNumber: string }, mode: Mode = 'cancel') => {
      setError(null);
      setTarget({ id: order.id, orderNumber: order.orderNumber, mode });
    },
    [],
  );

  const close = () => {
    if (!busy) setTarget(null);
  };

  const confirm = async () => {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    const result = await cancelOrder(target.id);
    setBusy(false);

    if (result.ok) {
      setTarget(null);
      if (readPendingPayment()?.orderId === target.id) forgetPendingPayment();
      // The header badge: the order's lines are back in the cart.
      void refreshCart();
      // "Change order" leaves this page, so it always says what happened.
      if (notice === 'toast' || target.mode === 'change') {
        const { title, skipped } = orderCancelledMessage(result.data.cart, t);
        showToast(title, 'success');
        if (skipped) showToast(skipped, 'info');
      }
      onCancelled(result.data);
      if (target.mode === 'change') router.push('/cart');
      return;
    }
    if (result.code === 'unauthenticated') {
      setTarget(null);
      await logout();
      router.replace(loginHref(`${window.location.pathname}${window.location.search}`));
      return;
    }
    if (result.reason === 'not_cancellable') {
      setTarget(null);
      showToast(localizePaymentError(result, t), 'error');
      onStale?.();
      return;
    }
    // Rate limit or the store couldn't be reached: stay open, so it can be tried again.
    setError(localizePaymentError(result, t));
  };

  const cancelDialog =
    typeof document !== 'undefined' && target
      ? createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
            <div
              dir={isRTL ? 'rtl' : 'ltr'}
              className="relative z-10 w-full max-w-sm bg-white rounded-xl shadow-2xl p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-order-title"
              aria-describedby="cancel-order-desc"
            >
              <h2 id="cancel-order-title" className="text-base font-serif font-bold text-[#2D1F1F] mb-1">
                {target.mode === 'change'
                  ? t.checkout.changeOrderConfirmTitle
                  : t.checkout.cancelOrderConfirmTitle}
              </h2>
              <p className="text-xs font-bold text-[#C9A84C] tracking-widest mb-3">
                <bdi dir="ltr">{target.orderNumber}</bdi>
              </p>
              <p id="cancel-order-desc" className="text-sm text-[#2D1F1F]/55 mb-6 leading-relaxed">
                {target.mode === 'change'
                  ? t.checkout.changeOrderConfirmDesc
                  : t.checkout.cancelOrderConfirmDesc}
              </p>
              {error ? (
                <p role="alert" className="text-sm text-red-600 mb-4">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void confirm()}
                  disabled={busy}
                  aria-busy={busy}
                  className={`flex-1 h-11 text-[11px] font-black tracking-[0.15em] uppercase rounded-md transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2 ${
                    target.mode === 'change'
                      ? 'bg-[#2D1F1F] text-white hover:bg-[#C9A84C] hover:text-[#2D1F1F]'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                  {target.mode === 'change' ? t.checkout.changeOrder : t.checkout.cancelOrder}
                </button>
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="flex-1 h-11 border border-[#2D1F1F]/15 text-[#2D1F1F] text-[11px] font-black tracking-[0.15em] uppercase rounded-md hover:bg-[#FAF7F2] transition-colors disabled:opacity-40"
                >
                  {t.checkout.keepOrder}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return { requestCancel, cancelDialog, cancelBusy: busy };
}

/** The small "Cancel order" text button, under or beside the payment buttons. */
export const cancelOrderButtonClass =
  'hit-area text-[10px] font-black tracking-[0.15em] uppercase text-[#2D1F1F]/55 hover:text-red-600 transition-colors disabled:opacity-40';

/** The small "Change order" text button next to it. */
export const changeOrderButtonClass =
  'hit-area text-[10px] font-black tracking-[0.15em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors disabled:opacity-40';
