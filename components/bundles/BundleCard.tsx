'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Gift } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import { formatMoney } from '@/utils/formatPrice';
import AddBundleButton from '@/components/bundles/AddBundleButton';
import type { BundleView } from '@/types';

export default function BundleCard({ bundle }: { bundle: BundleView }) {
  const { language, t } = useLanguage();
  const name = pickLocalized(language, bundle.name, bundle.nameAr);
  const href = `/bundles/${encodeURIComponent(bundle.slug)}`;
  const money = (amount: number) => formatMoney(amount, language, 'OMR', t.common.omr);

  return (
    <article className="flex flex-col border border-[#2D1F1F]/8 rounded-xl overflow-hidden bg-white">
      <Link href={href} className="relative block bg-[#F5F3EF] group" style={{ aspectRatio: '4/3' }}>
        <Image
          src={bundle.imageUrl}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 start-3 flex flex-wrap gap-1.5">
          {bundle.isGiftSet ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#2D1F1F] text-[#E8D5A3] text-[10px] font-bold tracking-widest uppercase rounded-md">
              <Gift size={11} aria-hidden />
              {t.bundles.giftSet}
            </span>
          ) : null}
          {bundle.savings !== null ? (
            <span className="px-2.5 py-0.5 bg-[#C9A84C] text-white text-[10px] font-bold tracking-widest uppercase rounded-md">
              {t.bundles.save.replace('{amount}', money(bundle.savings))}
            </span>
          ) : null}
        </div>
      </Link>
      <div className="flex flex-col flex-1 p-4 gap-2">
        <Link href={href} className="hit-area-sm text-sm font-semibold text-[#2D1F1F] hover:text-[#C9A84C] line-clamp-2">
          {name}
        </Link>
        <p className="text-xs text-[#2D1F1F]/45">
          {t.bundles.productsCount.replace('{count}', String(bundle.items.length))}
        </p>
        <p className="mt-auto flex items-baseline gap-2">
          <span className="text-base font-bold text-[#2D1F1F]"><bdi>{money(bundle.bundlePrice)}</bdi></span>
          {bundle.comparePrice !== null ? (
            <span className="text-xs text-[#2D1F1F]/40 line-through"><bdi>{money(bundle.comparePrice)}</bdi></span>
          ) : null}
        </p>
        <AddBundleButton bundleId={bundle.id} inStock={bundle.inStock} />
      </div>
    </article>
  );
}
