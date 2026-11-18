'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import BundleCard from '@/components/bundles/BundleCard';
import type { BundleView } from '@/types';

/** Home: the latest bundles, with a link to all of them. Hidden when none. */
export default function BundlesSection({ bundles }: { bundles: BundleView[] }) {
  const { t, isRTL } = useLanguage();
  if (bundles.length === 0) return null;

  return (
    <section className="bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-14 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
              {t.bundles.eyebrow}
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif text-[#2D1F1F]">{t.bundles.title}</h2>
            <p className="text-sm text-[#2D1F1F]/50 mt-2">{t.bundles.subtitle}</p>
          </div>
          <Link
            href="/bundles"
            className="hit-area text-[11px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F]"
          >
            {t.bundles.viewAll}
          </Link>
        </div>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {bundles.map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} />
          ))}
        </div>
      </div>
    </section>
  );
}
