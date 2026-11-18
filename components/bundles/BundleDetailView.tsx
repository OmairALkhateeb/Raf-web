'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Gift, Minus, Plus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import { formatMoney } from '@/utils/formatPrice';
import { BUNDLE_MAX_QUANTITY } from '@/lib/cart/validate';
import AddBundleButton from '@/components/bundles/AddBundleButton';
import Breadcrumb from '@/components/common/Breadcrumb';
import type { BundleView } from '@/types';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

export default function BundleDetailView({ bundle }: { bundle: BundleView }) {
  const { language, t, isRTL } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const name = pickLocalized(language, bundle.name, bundle.nameAr);
  const description = bundle.description
    ? pickLocalized(language, bundle.description, bundle.descriptionAr)
    : null;
  const money = (amount: number) => formatMoney(amount, language, 'OMR', t.common.omr);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={`${cx} py-8 sm:py-12`}>
      <Breadcrumb
        crumbs={[
          { label: t.nav.home, href: '/' },
          { label: t.bundles.title, href: '/bundles' },
          { label: name },
        ]}
      />
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 mt-6">
        <div className="relative bg-[#F5F3EF] rounded-xl overflow-hidden" style={{ aspectRatio: '1/1' }}>
          <Image src={bundle.imageUrl} alt={name} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
        </div>

        <div>
          {bundle.isGiftSet ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black tracking-[0.3em] uppercase text-[#C9A84C] mb-3">
              <Gift size={13} aria-hidden />
              {t.bundles.giftSet}
            </span>
          ) : null}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-[#2D1F1F] leading-tight mb-4">{name}</h1>

          <p className="flex flex-wrap items-baseline gap-3 mb-2">
            <span className="text-2xl font-bold text-[#2D1F1F]"><bdi>{money(bundle.bundlePrice)}</bdi></span>
            {bundle.comparePrice !== null ? (
              <span className="text-base text-[#2D1F1F]/40 line-through"><bdi>{money(bundle.comparePrice)}</bdi></span>
            ) : null}
            {bundle.savings !== null ? (
              <span className="px-2.5 py-0.5 bg-[#C9A84C]/12 text-[#C9A84C] text-xs font-bold rounded-md">
                {t.bundles.save.replace('{amount}', money(bundle.savings))}
              </span>
            ) : null}
          </p>
          {!bundle.inStock ? (
            <p className="text-sm font-semibold text-red-600 mb-4">{t.bundles.outOfStock}</p>
          ) : null}

          {description ? (
            <p className="text-sm text-[#2D1F1F]/65 leading-relaxed whitespace-pre-line mb-6">{description}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4 mb-8">
            <div className={`flex items-center border border-[#2D1F1F]/15 rounded-md overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label={t.product.decreaseQuantity}
                className="w-11 h-12 flex items-center justify-center text-[#2D1F1F]/60 hover:bg-[#2D1F1F]/5 disabled:opacity-40"
              >
                <Minus size={13} />
              </button>
              <span className="w-12 text-center text-sm font-semibold border-x border-[#2D1F1F]/15 h-12 flex items-center justify-center" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(BUNDLE_MAX_QUANTITY, q + 1))}
                disabled={quantity >= BUNDLE_MAX_QUANTITY}
                aria-label={t.product.increaseQuantity}
                className="w-11 h-12 flex items-center justify-center text-[#2D1F1F]/60 hover:bg-[#2D1F1F]/5 disabled:opacity-40"
              >
                <Plus size={13} />
              </button>
            </div>
            <AddBundleButton bundleId={bundle.id} inStock={bundle.inStock} quantity={quantity} size="lg" />
          </div>

          <h2 className="text-[11px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-3">
            {t.bundles.whatsInside}
          </h2>
          <ul className="border border-[#2D1F1F]/8 rounded-xl divide-y divide-[#2D1F1F]/8">
            {bundle.items.map((item) => {
              const option = item.variantLabel ? pickLocalized(language, item.variantLabel, item.variantLabelAr) : null;
              const itemName = `${pickLocalized(language, item.productName, item.productNameAr)}${option ? ` (${option})` : ''}`;
              const content = (
                <span className="flex items-center gap-3 p-3">
                  <span className="relative w-12 h-12 rounded-md overflow-hidden bg-[#F5F3EF] flex-shrink-0">
                    <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-[#2D1F1F]">
                    {itemName} <span className="text-[#2D1F1F]/45">× {item.quantity}</span>
                  </span>
                  {item.unitPrice !== null ? (
                    <span className="text-xs text-[#2D1F1F]/40 line-through">
                      <bdi>{money(item.unitPrice * item.quantity)}</bdi>
                    </span>
                  ) : null}
                </span>
              );
              return (
                <li key={item.id}>
                  {item.productSlug ? (
                    <Link href={`/products/${encodeURIComponent(item.productSlug)}`} className="block hover:bg-[#FAF7F2]">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
