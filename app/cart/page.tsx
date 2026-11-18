'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Trash2, ShoppingBag, ArrowRight, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import { formatLineOptions } from '@/lib/cart/options';
import { cartErrorMessage, cartIssueMessage } from '@/lib/cart/messages';
import CartBundleRow from '@/components/cart/CartBundleRow';
import { ListSkeleton } from '@/components/common/Loading';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

function formatMoney(
  amount: number,
  language: string,
  currency: string,
  omrLabel: string,
): string {
  const value = amount.toFixed(3);
  const label = currency === 'OMR' ? omrLabel : currency;
  return language === 'ar' ? `${value} ${label}` : `${label} ${value}`;
}

export default function CartPage() {
  const {
    items,
    bundles,
    issues,
    removeFromCart,
    removeBundleFromCart,
    mergeDroppedCount,
    mergeNotes,
    dismissMergeNotice,
    itemCount,
    hasLines,
    updateQuantity,
    subtotal,
    totals,
    currency,
    clearCart,
    status,
    isReady,
    isMutating,
    refreshCart,
  } = useCart();
  const { showToast } = useApp();
  const { language, t, isRTL } = useLanguage();
  const money = (amount: number) => formatMoney(amount, language, currency, t.common.omr);

  // The default address/method can't be delivered to (guide §2.2): its
  // shipping of 0 isn't free, and checkout will ask for another choice.
  const shippingUnavailable = totals?.shippingAvailable === false;

  // Free shipping applies when (subtotal − discount) reaches the threshold.
  const freeShippingHint = (() => {
    if (!totals || totals.freeShippingThreshold === null || shippingUnavailable) return null;
    const remaining = totals.freeShippingThreshold - (subtotal - totals.discountTotal);
    return remaining > 0
      ? t.cart.freeShippingRemaining.replace('{amount}', money(remaining))
      : t.cart.freeShippingReached;
  })();

  // Issues whose line isn't shown (e.g. a retired bundle the backend leaves
  // out of the cart lines): listed separately so they can still be removed.
  const issueOnly = issues.filter(issue =>
    issue.itemId !== null
      ? !items.some(item => item.itemId === issue.itemId)
      : !bundles.some(line => line.bundleItemId === issue.bundleItemId),
  );
  const isEmpty = isReady && !hasLines && issues.length === 0;

  if (status === 'loading') {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="border-b border-[#2D1F1F]/8 bg-white">
          <div className={`${cx} py-10 sm:py-14`}>
            <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
              {t.cart.shoppingBag}
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">{t.cart.title}</h1>
          </div>
        </div>
        <div className={`${cx} py-10 sm:py-14`}>
          <div className="grid lg:grid-cols-[1fr_400px] gap-10 lg:gap-16">
            <ListSkeleton rows={3} label={t.common.loading} />
            <div className="hidden lg:block">
              <ListSkeleton rows={2} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="border-b border-[#2D1F1F]/8 bg-white">
          <div className={`${cx} py-10 sm:py-14`}>
            <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
              {t.cart.shoppingBag}
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">{t.cart.title}</h1>
          </div>
        </div>
        <div className={`${cx} py-32 text-center`}>
          <h2 className="text-2xl font-serif text-[#2D1F1F] mb-3">{t.cart.unavailable}</h2>
          <p className="text-[#2D1F1F]/45 text-sm mb-10 max-w-xs mx-auto leading-relaxed">{t.cart.unavailableHint}</p>
          <button
            type="button"
            onClick={() => { void refreshCart(); }}
            className="inline-flex items-center gap-3 bg-[#2D1F1F] text-white px-10 py-3.5 text-[11px] font-black tracking-[0.25em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors duration-300"
          >
            {t.common.retry}
          </button>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="border-b border-[#2D1F1F]/8 bg-white">
          <div className={`${cx} py-10 sm:py-14`}>
            <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
              {t.cart.shoppingBag}
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">{t.cart.title}</h1>
          </div>
        </div>
        <div className={`${cx} py-32 text-center`}>
          <ShoppingBag size={48} strokeWidth={1} className="text-[#2D1F1F]/15 mx-auto mb-8" />
          <h2 className="text-2xl font-serif text-[#2D1F1F] mb-3">{t.cart.empty}</h2>
          <p className="text-[#2D1F1F]/45 text-sm mb-10 max-w-xs mx-auto leading-relaxed">{t.cart.emptyDesc}</p>
          <Link
            href="/products"
            className="inline-flex items-center gap-3 bg-[#2D1F1F] text-white px-10 py-3.5 text-[11px] font-black tracking-[0.25em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors duration-300"
          >
            {t.cart.continueShopping}
            <ArrowRight size={14} className={isRTL ? 'rtl-flip' : ''} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
              {t.cart.shoppingBag}
          </span>
          <div className="flex items-end justify-between gap-4">
            <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">{t.cart.title}</h1>
            <p className="text-[#2D1F1F]/40 text-sm pb-1">
              {itemCount} {t.cart.items}
            </p>
          </div>
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        <div className="grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-16">
          <div>
            {mergeDroppedCount > 0 ? (
              <div
                className="mb-6 flex items-start justify-between gap-4 border border-amber-200 bg-amber-50 rounded-md px-4 py-3"
                role="status"
              >
                {mergeNotes.length > 0 ? (
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold">{t.cart.mergeNotesTitle}</p>
                    <ul className="mt-1 list-disc ps-5 space-y-0.5">
                      {mergeNotes.map((note, i) => {
                        const noteName = pickLocalized(language, note.name, note.nameAr);
                        return (
                          <li key={`${note.name}-${i}`}>
                            {note.code === 'capped' && note.merged !== null && note.requested !== null
                              ? t.cart.mergeNoteCapped
                                  .replace('{name}', noteName)
                                  .replace('{merged}', String(note.merged))
                                  .replace('{requested}', String(note.requested))
                              : t.cart.mergeNoteDropped.replace('{name}', noteName)}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-amber-800">{t.cart.mergeDropped}</p>
                )}
                <button
                  type="button"
                  onClick={dismissMergeNotice}
                  className="text-[10px] font-bold tracking-[0.15em] uppercase text-amber-800 hover:text-[#2D1F1F]"
                >
                  {t.common.close}
                </button>
              </div>
            ) : null}
            {issueOnly.length > 0 && (
              <div className="mb-6 space-y-3">
                {issueOnly.map(issue => (
                  <div
                    key={`issue-${issue.itemId ?? `b${issue.bundleItemId}`}`}
                    className="flex items-center justify-between gap-4 border border-red-100 bg-red-50/70 rounded-md px-4 py-3"
                  >
                    <p className="text-sm text-[#2D1F1F]/70">{cartIssueMessage(issue.reason, t)}</p>
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={async () => {
                        const result =
                          issue.itemId !== null
                            ? await removeFromCart(issue.itemId)
                            : await removeBundleFromCart(issue.bundleItemId!);
                        if (result.ok) showToast(t.common.itemRemoved);
                        else showToast(cartErrorMessage(result, t), 'error');
                      }}
                      className="text-[10px] font-bold tracking-[0.15em] uppercase text-red-500 hover:text-red-600 disabled:opacity-40"
                    >
                      {t.cart.remove}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-[#2D1F1F]/8">
              <AnimatePresence>
                {items.map(item => {
                  const lineIssue = issues.find(issue => issue.itemId === item.itemId);
                  const productHref = item.slug ? `/products/${encodeURIComponent(item.slug)}` : null;
                  const itemName = pickLocalized(language, item.name, item.nameAr);
                  return (
                    <motion.div
                      key={item.itemId}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: isRTL ? 30 : -30 }}
                      className="flex gap-5 py-6 border-b border-[#2D1F1F]/8"
                    >
                      {productHref ? (
                        <Link
                          href={productHref}
                          aria-label={itemName}
                          className="relative w-24 h-28 sm:w-28 sm:h-32 overflow-hidden bg-[#F5F3EF] rounded-md flex-shrink-0 group"
                        >
                          <Image
                            src={item.imageUrl}
                            alt={itemName}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="112px"
                          />
                        </Link>
                      ) : (
                        <div className="relative w-24 h-28 sm:w-28 sm:h-32 overflow-hidden bg-[#F5F3EF] rounded-md flex-shrink-0">
                          <Image
                            src={item.imageUrl}
                            alt={itemName}
                            fill
                            className="object-cover"
                            sizes="112px"
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-base font-medium text-[#2D1F1F] leading-snug line-clamp-2">
                          {productHref ? (
                            <Link
                              href={productHref}
                              className="hit-area-sm hover:text-[#C9A84C] transition-colors focus-visible:outline-none focus-visible:underline"
                            >
                              {itemName}
                            </Link>
                          ) : (
                            itemName
                          )}
                        </h3>
                        {formatLineOptions(item.options) && (
                          <p className="text-xs text-[#2D1F1F]/50 mt-1" dir="auto">
                            {formatLineOptions(item.options)}
                          </p>
                        )}
                        {lineIssue && (
                          <p className="text-xs text-red-500 mt-1">{cartIssueMessage(lineIssue.reason, t, lineIssue.available)}</p>
                        )}

                        <div className="flex items-center justify-between mt-4">
                          {/*
                            Keep flex-row-reverse on the inner stepper so minus stays
                            physically left, quantity center, and plus right under dir=rtl.
                          */}
                          <div className={`flex items-center border border-[#2D1F1F]/15 rounded-md overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <button
                              type="button"
                              disabled={!isReady || isMutating || item.quantity <= 1}
                              onClick={async () => {
                                const result = await updateQuantity(item.itemId, item.quantity - 1);
                                if (!result.ok) showToast(cartErrorMessage(result, t), 'error');
                              }}
                              aria-label={`${t.product.decreaseQuantity}: ${pickLocalized(language, item.name, item.nameAr)}`}
                              className="w-9 h-9 flex items-center justify-center text-[#2D1F1F]/60 hover:text-[#2D1F1F] hover:bg-[#2D1F1F]/5 transition-colors disabled:opacity-40"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="w-10 text-center text-sm font-semibold text-[#2D1F1F] border-x border-[#2D1F1F]/15 h-9 flex items-center justify-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={!isReady || isMutating}
                              onClick={async () => {
                                const result = await updateQuantity(item.itemId, item.quantity + 1);
                                if (!result.ok) showToast(cartErrorMessage(result, t), 'error');
                              }}
                              aria-label={`${t.product.increaseQuantity}: ${pickLocalized(language, item.name, item.nameAr)}`}
                              className="w-9 h-9 flex items-center justify-center text-[#2D1F1F]/60 hover:text-[#2D1F1F] hover:bg-[#2D1F1F]/5 transition-colors disabled:opacity-40"
                            >
                              <Plus size={12} />
                            </button>
                          </div>

                          <div className="flex items-center gap-5">
                            <span className="text-base font-bold text-[#2D1F1F]">
                              {formatMoney(item.lineTotal, language, currency, t.common.omr)}
                            </span>
                            <button
                              type="button"
                              disabled={!isReady || isMutating}
                              onClick={async () => {
                                const result = await removeFromCart(item.itemId);
                                if (result.ok) showToast(t.common.itemRemoved);
                                else showToast(cartErrorMessage(result, t), 'error');
                              }}
                              aria-label={`${t.cart.remove}: ${pickLocalized(language, item.name, item.nameAr)}`}
                              className="hit-area text-[#2D1F1F]/25 hover:text-red-500 transition-colors disabled:opacity-40"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {bundles.map(line => (
                  <CartBundleRow
                    key={`bundle-${line.bundleItemId}`}
                    line={line}
                    issue={issues.find(issue => issue.bundleItemId === line.bundleItemId)}
                    currency={currency}
                  />
                ))}
              </AnimatePresence>
            </div>

            <div className="pt-5">
              <button
                type="button"
                disabled={!isReady || isMutating}
                onClick={async () => {
                  const result = await clearCart();
                  if (result.ok) showToast(t.cart.clearCart);
                  else showToast(cartErrorMessage(result, t), 'error');
                }}
                className="hit-area text-[10px] font-bold tracking-[0.15em] uppercase text-[#2D1F1F]/30 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                {t.cart.clearCart}
              </button>
            </div>
          </div>

          <div>
            <div className="border border-[#2D1F1F]/8 rounded-xl p-6 sticky top-24">
              <h3 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-6">
                {t.cart.orderSummary}
              </h3>

              <div className="space-y-3.5 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-[#2D1F1F]/55">{t.cart.subtotal}</span>
                  <span className="font-medium text-[#2D1F1F]">{money(subtotal)}</span>
                </div>
                {totals && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#2D1F1F]/55">{t.cart.shipping}</span>
                      <span
                        className={`font-medium text-end ${shippingUnavailable ? 'text-amber-700' : 'text-[#2D1F1F]'}`}
                      >
                        {shippingUnavailable
                          ? t.cart.shippingNotAvailable
                          : totals.shippingTotal === 0
                            ? t.common.free
                            : money(totals.shippingTotal)}
                      </span>
                    </div>
                    {totals.taxRate > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#2D1F1F]/55">
                          {t.cart.vat.replace('{rate}', String(totals.taxRate))}
                        </span>
                        <span className="font-medium text-[#2D1F1F]">{money(totals.taxTotal)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="border-t border-[#2D1F1F]/8 pt-5 mb-6">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-[#2D1F1F] tracking-wide uppercase">{t.cart.total}</span>
                  <span className="text-xl font-bold text-[#C9A84C]">
                    {money(totals ? totals.grandTotal : subtotal)}
                  </span>
                </div>
              </div>

              {totals && hasLines && (
                <div className="-mt-3 mb-6 space-y-1.5 text-xs leading-relaxed text-[#2D1F1F]/50">
                  {freeShippingHint && (
                    <p className="font-semibold text-[#B8860B]">{freeShippingHint}</p>
                  )}
                  {shippingUnavailable ? (
                    <p className="text-amber-700">{t.cart.shippingNotAvailableNote}</p>
                  ) : (
                    <p>{totals.shippingEstimated ? t.cart.shippingEstimatedNote : t.cart.shippingDefaultNote}</p>
                  )}
                </div>
              )}

              {isReady && hasLines && !isMutating ? (
                <Link
                  href="/checkout"
                  className="flex w-full items-center justify-center gap-3 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.25em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors"
                  style={{ height: 52 }}
                >
                  {t.cart.checkout}
                  <ArrowRight size={14} className={isRTL ? 'rtl-flip' : ''} />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-3 bg-[#2D1F1F]/40 text-white text-[11px] font-black tracking-[0.25em] uppercase rounded-md cursor-not-allowed"
                  style={{ height: 52 }}
                >
                  {t.cart.checkout}
                </button>
              )}

              <Link
                href="/products"
                className="hit-area-sm block text-center text-[11px] font-bold tracking-[0.15em] uppercase text-[#2D1F1F]/35 hover:text-[#C9A84C] mt-4 transition-colors"
              >
                {t.cart.continueShopping}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
