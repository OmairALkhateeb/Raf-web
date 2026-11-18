'use client';

import Link from 'next/link';
import { CheckCircle, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { OrderCancelCart } from '@/types/api/account';
import type { Dictionary } from '@/utils/translations';

/** The one line said after "Cancel order", and what couldn't go back in the cart. */
export function orderCancelledMessage(cart: OrderCancelCart, t: Dictionary) {
  const title = cart.restored > 0 ? t.checkout.orderCancelledByYou : t.checkout.orderCancelledTitle;
  const skipped =
    cart.skipped.length > 0
      ? t.checkout.cancelSkipped.replace('{names}', cart.skipped.join(t.common.listSeparator))
      : null;
  return { title, skipped };
}

/**
 * Shown after the customer cancelled an unpaid order: its items are back in
 * the cart (guide §5.3-b), with a way there, and the names of any that
 * couldn't go back (sold out or no longer sold).
 */
export default function OrderCancelledNotice({
  cart,
  className = '',
}: {
  cart: OrderCancelCart;
  className?: string;
}) {
  const { t } = useLanguage();
  const { title, skipped } = orderCancelledMessage(cart, t);
  return (
    <div
      role="status"
      className={`rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 text-start ${className}`}
    >
      <CheckCircle size={20} className="text-emerald-700 flex-shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#2D1F1F]">{title}</p>
        {skipped ? <p className="text-xs text-[#2D1F1F]/60 mt-1 leading-relaxed">{skipped}</p> : null}
      </div>
      <Link
        href="/cart"
        className="h-10 px-4 bg-[#C9A84C] text-[#2D1F1F] text-[10px] font-black tracking-[0.15em] uppercase rounded-md inline-flex items-center justify-center gap-2 hover:bg-[#2D1F1F] hover:text-white transition-colors flex-shrink-0"
      >
        <ShoppingBag size={13} aria-hidden />
        {t.checkout.goToCart}
      </Link>
    </div>
  );
}
