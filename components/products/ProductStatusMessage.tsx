'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export type ProductStatusKind = 'unavailable' | 'data-error' | 'not-found';

export default function ProductStatusMessage({
  kind,
}: {
  kind: ProductStatusKind;
}) {
  const { t, isRTL } = useLanguage();

  const copy =
    kind === 'unavailable'
      ? {
          title: t.product.productUnavailable,
          hint: t.product.productUnavailableHint,
        }
      : kind === 'data-error'
        ? {
            title: t.product.dataError,
            hint: t.product.dataErrorHint,
          }
        : {
            title: t.product.productNotFound,
            hint: t.product.productNotFoundHint,
          };

  return (
    <div className="bg-[#FAF7F2]" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-32 text-center">
        <p className="text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-4">
          RAF
        </p>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2D1F1F] mb-3">
          {copy.title}
        </h1>
        <p className="text-sm text-[#2D1F1F]/45">{copy.hint}</p>
        {kind === 'not-found' ? (
          <Link
            href="/products"
            className="inline-flex items-center justify-center mt-10 bg-[#2D1F1F] text-white px-10 py-3.5 rounded-md hover:bg-[#C9A84C] transition-colors duration-300"
          >
            <span className="text-[11px] font-black tracking-[0.25em] uppercase">
              {t.product.backToProducts}
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
