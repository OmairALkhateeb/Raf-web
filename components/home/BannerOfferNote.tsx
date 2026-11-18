'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import type { Banner } from '@/types';

/** An offer banner's description and end date (frontend guide §7). */
export default function BannerOfferNote({ banner, className }: { banner: Banner; className?: string }) {
  const { language, t } = useLanguage();
  const description = banner.description
    ? pickLocalized(language, banner.description, banner.descriptionAr)
    : null;
  const ends = banner.endsAt ? new Date(banner.endsAt) : null;
  const endsLabel =
    ends && !Number.isNaN(ends.getTime())
      ? t.banners.endsOn.replace(
          '{date}',
          // Oman time, so the server render and the browser always agree.
          ends.toLocaleDateString(language === 'ar' ? 'ar-OM' : 'en-GB', {
            day: 'numeric',
            month: 'long',
            timeZone: 'Asia/Muscat',
          }),
        )
      : null;
  if (!description && !endsLabel) return null;
  return (
    <div className={className}>
      {description ? <p className="line-clamp-2">{description}</p> : null}
      {endsLabel ? <p className="mt-1 text-[11px] font-bold tracking-[0.15em] uppercase text-[#E8D5A3]">{endsLabel}</p> : null}
    </div>
  );
}
