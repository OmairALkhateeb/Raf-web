'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { pickLocalized } from '@/lib/i18n/language';
import { orderBadge } from '@/lib/account/status';
import { localizePaymentError } from '@/lib/account/messages';
import { useNow } from '@/lib/account/useNow';
import { startPayment } from '@/lib/checkout/start-payment';
import { useCancelOrder } from '@/lib/checkout/useCancelOrder';
import { loginHref } from '@/lib/auth/next-path';
import { formatMoney } from '@/utils/formatPrice';
import OrderPaymentActions from '@/components/account/OrderPaymentActions';
import type { AccountOrder } from '@/types';

function formatOrderDate(iso: string, language: 'en' | 'ar'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(language === 'ar' ? 'ar-OM' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * One order in "My orders": a link to its page, and — outside the link, so
 * no button sits inside it — "Complete payment" / "Try again" with a
 * countdown while it can still be paid (guide §4.6, §6.3).
 */
export default function AccountOrderRow({
  order,
  isLast,
  onChanged,
}: {
  order: AccountOrder;
  isLast: boolean;
  /** The order changed state ("Try again", "Cancel order", paid meanwhile…): reload the list. */
  onChanged: () => void;
}) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const { showToast } = useApp();
  const [busy, setBusy] = useState(false);
  // Only an unpaid order needs a ticking clock (countdown, "time over").
  const now = useNow(order.status === 'pending_payment');
  const badge = orderBadge(order, now, t.account);
  // The list row is only a summary: say it in a toast and reload the list.
  const { requestCancel, cancelDialog } = useCancelOrder({
    notice: 'toast',
    onCancelled: onChanged,
    onStale: onChanged,
  });

  // Back from Thawani can restore the page from the browser's cache mid-redirect.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    const result = await startPayment(order);
    if (result.ok && result.redirected) return;
    setBusy(false);
    if (result.ok) {
      onChanged();
      return;
    }
    if (result.code === 'unauthenticated') {
      await logout();
      router.replace(loginHref('/account'));
      return;
    }
    showToast(localizePaymentError(result, t), 'error');
    if (result.reason === 'payment_closed') onChanged();
  };

  return (
    <div className={isLast ? '' : 'border-b border-[#2D1F1F]/8'}>
      <Link
        href={`/account/orders/${order.id}`}
        className="block px-6 py-5 hover:bg-[#FAF7F2]/60 transition-colors focus-visible:outline-none focus-visible:bg-[#FAF7F2]"
        aria-label={`${t.account.viewOrder}: ${order.orderNumber}`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-bold text-[#2D1F1F] tracking-wide">{order.orderNumber}</p>
            <p className="text-xs text-[#2D1F1F]/40 mt-0.5">
              {formatOrderDate(order.placedAt, language)}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <span
              className={`px-3 py-1 text-[10px] font-black tracking-[0.12em] uppercase rounded-md ${badge.bg} ${badge.text}`}
            >
              {badge.label}
            </span>
            <span className="text-sm font-bold text-[#2D1F1F]">
              {formatMoney(order.grandTotal, language, order.currency, t.common.omr)}
            </span>
          </div>
        </div>

        {order.items.length > 0 ? (
          <div className="flex gap-2">
            {order.items.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="relative w-14 h-14 overflow-hidden bg-[#F5F3EF] border border-[#2D1F1F]/8 rounded-md flex-shrink-0"
              >
                <Image
                  src={item.imageUrl}
                  alt={pickLocalized(language, item.productName, item.productNameAr)}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>
            ))}
            {order.items.length > 4 && (
              <div className="w-14 h-14 border border-[#2D1F1F]/8 rounded-md flex items-center justify-center text-xs font-bold text-[#2D1F1F]/40 bg-[#FAF7F2]">
                +{order.items.length - 4}
              </div>
            )}
          </div>
        ) : null}
      </Link>

      {order.status === 'pending_payment' ? (
        <div className="px-6 pb-5 -mt-1">
          <OrderPaymentActions
            order={order}
            now={now}
            busy={busy}
            onPay={() => void pay()}
            variant="row"
            onCancel={() => requestCancel(order)}
          />
        </div>
      ) : null}
      {cancelDialog}
    </div>
  );
}
