'use client';

import type { ReactNode } from 'react';
import { FileText, Info, ShieldCheck, Truck, Undo2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

export type CmsDocumentChrome =
  | 'privacy'
  | 'terms'
  | 'shipping'
  | 'about'
  | 'returnsPolicy'
  | 'page';
export type CmsDocumentStatus = 'ok' | 'not-found' | 'unavailable';

interface CmsDocumentViewProps {
  status: CmsDocumentStatus;
  chrome: CmsDocumentChrome;
  title?: string;
  updatedAt?: string;
  children?: ReactNode;
}

const KNOWN_CHROME_ICONS = {
  privacy: ShieldCheck,
  terms: FileText,
  shipping: Truck,
  about: Info,
  returnsPolicy: Undo2,
} as const;

function formatUpdatedAt(iso: string, language: 'en' | 'ar'): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function StatusBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-24 text-center">
      <p className="text-lg font-serif text-[#2D1F1F]">{title}</p>
      {hint ? <p className="text-[#2D1F1F]/45 text-sm mt-2">{hint}</p> : null}
    </div>
  );
}

export default function CmsDocumentView({
  status,
  chrome,
  title,
  updatedAt,
  children,
}: CmsDocumentViewProps) {
  const { language, t, isRTL } = useLanguage();
  const formatted = updatedAt ? formatUpdatedAt(updatedAt, language) : null;

  if (chrome === 'page') {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        {status === 'ok' && title ? (
          <div className="border-b border-[#2D1F1F]/8 bg-white">
            <div className={`${cx} py-10 sm:py-14`}>
              <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">{title}</h1>
              {formatted ? (
                <p className="text-sm text-[#2D1F1F]/45 mt-3">
                  {t.common.lastUpdated}: {formatted}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={`${cx} py-10 sm:py-14`}>
          {status === 'not-found' ? (
            <StatusBlock
              title={t.common.pageUnavailable}
              hint={t.cms.notPublished}
            />
          ) : null}

          {status === 'unavailable' ? (
            <StatusBlock
              title={t.common.pageLoadError}
              hint={t.cms.tryAgainSoon}
            />
          ) : null}

          {status === 'ok' ? children : null}
        </div>
      </div>
    );
  }

  const Icon = KNOWN_CHROME_ICONS[chrome];
  const copy =
    chrome === 'shipping'
      ? {
          eyebrow: t.cms.delivery,
          fallbackTitle: t.footer.shipping,
          aside: t.cms.delivery,
        }
      : chrome === 'about'
        ? {
            eyebrow: t.nav.about,
            fallbackTitle: t.nav.about,
            aside: t.nav.about,
          }
        : chrome === 'returnsPolicy'
          ? {
              eyebrow: t.cms.legal,
              fallbackTitle: t.footer.returnsPolicy,
              aside: t.cms.legal,
            }
          : {
              eyebrow: t.cms.legal,
              fallbackTitle:
                chrome === 'privacy' ? t.footer.privacy : t.footer.terms,
              aside: t.cms.legal,
            };
  const heading = title ?? copy.fallbackTitle;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {copy.eyebrow}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">{heading}</h1>
          {status === 'ok' && formatted ? (
            <p className="text-sm text-[#2D1F1F]/45 mt-3">
              {t.common.lastUpdated}: {formatted}
            </p>
          ) : null}
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        {status === 'not-found' ? (
          <StatusBlock
            title={t.common.pageUnavailable}
            hint={t.cms.notPublished}
          />
        ) : null}

        {status === 'unavailable' ? (
          <StatusBlock
            title={t.common.pageLoadError}
            hint={t.cms.tryAgainSoon}
          />
        ) : null}

        {status === 'ok' ? (
          <div className="grid lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16">
            <div className="border border-[#2D1F1F]/8 rounded-xl p-8 bg-[#FAF7F2] h-fit sticky top-24">
              <div className="w-11 h-11 flex items-center justify-center bg-[#C9A84C]/10 rounded-md mb-4">
                <Icon size={18} className="text-[#C9A84C]" />
              </div>
              <h2 className="text-base font-bold text-[#2D1F1F]">{copy.aside}</h2>
            </div>
            <div>{children}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
