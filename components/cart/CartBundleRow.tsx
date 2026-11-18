'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Gift, Minus, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import { cartErrorMessage, cartIssueMessage } from '@/lib/cart/messages';
import { BUNDLE_MAX_QUANTITY } from '@/lib/cart/validate';
import { formatMoney } from '@/utils/formatPrice';
import type { CartBundleLine, CartIssue } from '@/types';

type Props = {
  line: CartBundleLine;
  issue?: CartIssue;
  currency: string;
};

/** A bundle in the cart: its contents, price, quantity (max 99) and remove. */
export default function CartBundleRow({ line, issue, currency }: Props) {
  const { updateBundleQuantity, removeBundleFromCart, isReady, isMutating } = useCart();
  const { showToast } = useApp();
  const { language, t, isRTL } = useLanguage();

  const name = pickLocalized(language, line.name, line.nameAr);
  const href = `/bundles/${encodeURIComponent(line.slug)}`;
  const money = (amount: number) => formatMoney(amount, language, currency, t.common.omr);
  const contents = line.contents
    .map((c) => {
      const option = c.variantLabel ? pickLocalized(language, c.variantLabel, c.variantLabelAr) : null;
      return `${pickLocalized(language, c.name, c.nameAr)}${option ? ` (${option})` : ''} × ${c.quantity}`;
    })
    .join(t.common.listSeparator);
  const fullPrice =
    line.comparePrice !== null && line.comparePrice > line.unitPrice
      ? line.comparePrice * line.quantity
      : null;

  const change = async (quantity: number) => {
    const result = await updateBundleQuantity(line.bundleItemId, quantity);
    if (!result.ok) showToast(cartErrorMessage(result, t), 'error');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: isRTL ? 30 : -30 }}
      className="flex gap-5 py-6 border-b border-[#2D1F1F]/8"
    >
      <Link
        href={href}
        aria-label={name}
        className="relative w-24 h-28 sm:w-28 sm:h-32 overflow-hidden bg-[#F5F3EF] rounded-md flex-shrink-0 group"
      >
        <Image
          src={line.imageUrl}
          alt={name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="112px"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-[0.15em] uppercase text-[#C9A84C]">
          <Gift size={11} aria-hidden />
          {t.bundles.bundle}
        </span>
        <h3 className="text-sm sm:text-base font-medium text-[#2D1F1F] leading-snug line-clamp-2 mt-0.5">
          <Link
            href={href}
            className="hit-area-sm hover:text-[#C9A84C] transition-colors focus-visible:outline-none focus-visible:underline"
          >
            {name}
          </Link>
        </h3>
        {contents ? (
          <p className="text-xs text-[#2D1F1F]/50 mt-1 line-clamp-2">
            {t.bundles.includes} {contents}
          </p>
        ) : null}
        {issue ? (
          <p className="text-xs text-red-500 mt-1">{cartIssueMessage(issue.reason, t)}</p>
        ) : null}

        <div className="flex items-center justify-between mt-4">
          {/* Same stepper layout as product lines: minus stays physically left. */}
          <div className={`flex items-center border border-[#2D1F1F]/15 rounded-md overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              type="button"
              disabled={!isReady || isMutating || line.quantity <= 1}
              onClick={() => void change(line.quantity - 1)}
              aria-label={`${t.product.decreaseQuantity}: ${name}`}
              className="w-9 h-9 flex items-center justify-center text-[#2D1F1F]/60 hover:text-[#2D1F1F] hover:bg-[#2D1F1F]/5 transition-colors disabled:opacity-40"
            >
              <Minus size={12} />
            </button>
            <span className="w-10 text-center text-sm font-semibold text-[#2D1F1F] border-x border-[#2D1F1F]/15 h-9 flex items-center justify-center">
              {line.quantity}
            </span>
            <button
              type="button"
              disabled={!isReady || isMutating || line.quantity >= BUNDLE_MAX_QUANTITY}
              onClick={() => void change(line.quantity + 1)}
              aria-label={`${t.product.increaseQuantity}: ${name}`}
              className="w-9 h-9 flex items-center justify-center text-[#2D1F1F]/60 hover:text-[#2D1F1F] hover:bg-[#2D1F1F]/5 transition-colors disabled:opacity-40"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="flex items-center gap-5">
            <span className="text-end">
              <span className="block text-base font-bold text-[#2D1F1F]">
                <bdi>{money(line.lineTotal)}</bdi>
              </span>
              {fullPrice !== null ? (
                <span className="block text-xs text-[#2D1F1F]/40 line-through">
                  <bdi>{money(fullPrice)}</bdi>
                </span>
              ) : null}
            </span>
            <button
              type="button"
              disabled={!isReady || isMutating}
              onClick={async () => {
                const result = await removeBundleFromCart(line.bundleItemId);
                if (result.ok) showToast(t.common.itemRemoved);
                else showToast(cartErrorMessage(result, t), 'error');
              }}
              aria-label={`${t.cart.remove}: ${name}`}
              className="hit-area text-[#2D1F1F]/25 hover:text-red-500 transition-colors disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
