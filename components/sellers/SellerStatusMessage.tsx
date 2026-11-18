'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export type SellerStatusKind = 'not-found' | 'unavailable' | 'data-error';

/** Full-page message for a store that can't be shown. */
export default function SellerStatusMessage({ kind }: { kind: SellerStatusKind }) {
  const { t, isRTL } = useLanguage();
  const router = useRouter();
  const copy = t.seller;

  const { title, hint } =
    kind === 'not-found'
      ? { title: copy.notFound, hint: copy.notFoundHint }
      : kind === 'unavailable'
        ? { title: copy.unavailable, hint: copy.unavailableHint }
        : { title: copy.dataError, hint: copy.dataErrorHint };

  const buttonClass =
    'inline-flex items-center justify-center mt-10 bg-[#2D1F1F] text-white px-10 py-3.5 rounded-md hover:bg-[#C9A84C] transition-colors duration-300';
  const labelClass = 'text-[11px] font-black tracking-[0.25em] uppercase';

  return (
    <div className="bg-[#FAF7F2]" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-32 text-center">
        <p className="text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-4">RAF</p>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2D1F1F] mb-3">{title}</h1>
        <p className="text-sm text-[#2D1F1F]/45">{hint}</p>
        {kind === 'not-found' ? (
          <Link href="/products" className={buttonClass}>
            <span className={labelClass}>{copy.browseProducts}</span>
          </Link>
        ) : (
          <button type="button" onClick={() => router.refresh()} className={buttonClass}>
            <span className={labelClass}>{copy.tryAgain}</span>
          </button>
        )}
      </div>
    </div>
  );
}
