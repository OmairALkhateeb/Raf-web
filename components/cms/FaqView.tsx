'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, HelpCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import type { FaqItemView } from '@/types/api/cms';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

export type FaqViewStatus = 'ok' | 'empty' | 'unavailable';

interface FaqViewProps {
  status: FaqViewStatus;
  items: FaqItemView[];
}

interface FaqGroup {
  category: string | null;
  categoryAr: string | null;
  anchor: string;
  items: FaqItemView[];
}

function categoryAnchor(category: string | null, used: Set<string>): string {
  const raw = (category ?? 'general').trim() || 'general';
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '');
  let anchor = `cat-${slug || 'general'}`;
  let n = 2;
  while (used.has(anchor)) {
    anchor = `cat-${slug || 'general'}-${n}`;
    n += 1;
  }
  used.add(anchor);
  return anchor;
}

function groupFaqs(items: FaqItemView[]): FaqGroup[] {
  const used = new Set<string>();
  const order: string[] = [];
  const map = new Map<string, FaqGroup>();

  for (const item of items) {
    const key = item.category ?? '';
    let group = map.get(key);
    if (!group) {
      group = {
        category: item.category,
        categoryAr: item.categoryAr,
        anchor: categoryAnchor(item.category, used),
        items: [],
      };
      map.set(key, group);
      order.push(key);
    }
    group.items.push(item);
  }

  return order.map(key => map.get(key)!);
}

function categoryLabel(
  group: { category: string | null; categoryAr: string | null },
  generalLabel: string,
  language: 'en' | 'ar',
): string {
  if (group.category === null) {
    return generalLabel;
  }
  return pickLocalized(language, group.category, group.categoryAr);
}

export default function FaqView({ status, items }: FaqViewProps) {
  const { language, t, isRTL } = useLanguage();
  const groups = groupFaqs(items);
  const [openId, setOpenId] = useState<number | null>(items[0]?.id ?? null);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.common.helpCenter}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.footer.faq}
          </h1>
          <p className="text-sm text-[#2D1F1F]/45 mt-3 max-w-xl leading-relaxed">
            {t.common.faqsIntro}
          </p>
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        {status === 'unavailable' ? (
          <StatusBlock
            title={t.common.faqsLoadError}
            hint={t.cms.tryAgainSoon}
          />
        ) : null}

        {status === 'empty' ? (
          <StatusBlock title={t.common.noFaqs} />
        ) : null}

        {status === 'ok' ? (
          <div className="grid lg:grid-cols-[220px_1fr] gap-10 lg:gap-14" style={{ alignItems: 'start' }}>
            <div className="hidden lg:block sticky top-24">
              <div className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden">
                {groups.map((group, i) => (
                  <a
                    key={group.anchor}
                    href={`#${group.anchor}`}
                    className={`block px-5 py-3.5 text-sm font-medium text-[#2D1F1F]/70 hover:text-[#C9A84C] hover:bg-[#FAF7F2] transition-colors ${
                      i < groups.length - 1 ? 'border-b border-[#2D1F1F]/8' : ''
                    }`}
                  >
                    {categoryLabel(group, t.common.general, language)}
                  </a>
                ))}
              </div>

              <div className="mt-6 border border-[#2D1F1F]/8 rounded-xl p-6 bg-[#FAF7F2]">
                <HelpCircle size={20} className="text-[#C9A84C] mb-3" />
                <p className="text-sm text-[#2D1F1F]/60 leading-relaxed mb-4">
                  {t.common.stillNeedHelp}
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 text-[11px] font-black tracking-[0.15em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                >
                  {t.footer.contact}
                  <ArrowRight size={13} className={isRTL ? 'rtl-flip' : ''} />
                </Link>
              </div>
            </div>

            <div className="space-y-10">
              {groups.map(group => (
                <div key={group.anchor} id={group.anchor}>
                  <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-4">
                    {categoryLabel(group, t.common.general, language)}
                  </h2>
                  <div className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden">
                    {group.items.map((item, ii) => {
                      const isOpen = openId === item.id;
                      return (
                        <div
                          key={item.id}
                          className={ii < group.items.length - 1 ? 'border-b border-[#2D1F1F]/8' : ''}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenId(isOpen ? null : item.id)}
                            className="w-full flex items-center justify-between gap-4 px-6 py-5 text-start hover:bg-[#FAF7F2] transition-colors"
                          >
                            <span className="text-sm font-bold text-[#2D1F1F]">{pickLocalized(language, item.question, item.questionAr)}</span>
                            <Plus
                              size={16}
                              className={`flex-shrink-0 text-[#C9A84C] transition-transform duration-300 ${
                                isOpen ? 'rotate-45' : ''
                              }`}
                            />
                          </button>
                          <AnimatePresence initial={false}>
                            {isOpen ? (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <p className="px-6 pb-5 text-sm text-[#2D1F1F]/55 leading-relaxed whitespace-pre-wrap">
                                  {pickLocalized(language, item.answer, item.answerAr)}
                                </p>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusBlock({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-24 text-center">
      <p className="text-lg font-serif text-[#2D1F1F]">{title}</p>
      {hint ? <p className="text-[#2D1F1F]/45 text-sm mt-2">{hint}</p> : null}
    </div>
  );
}
