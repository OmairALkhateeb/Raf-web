'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function HomeUnavailable() {
  const { t, isRTL } = useLanguage();

  return (
    <div className="bg-[#FAF7F2]" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-32 text-center">
        <p className="text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-4">
          RAF
        </p>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2D1F1F] mb-3">
          {t.home.unavailable}
        </h1>
        <p className="text-sm text-[#2D1F1F]/55">{t.home.unavailableHint}</p>
      </div>
    </div>
  );
}
