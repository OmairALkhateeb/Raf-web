'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { searchPageHref } from '@/lib/search/params';
import type { Product } from '@/types';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

export type SearchPageStatus =
  | 'idle'
  | 'ok'
  | 'empty'
  | 'invalid'
  | 'unavailable'
  | 'data-error';

export type SearchPageMeta = {
  total: number;
  currentPage: number;
  lastPage: number;
  perPage: number;
};

type SearchViewProps = {
  status: SearchPageStatus;
  q: string;
  products: Product[];
  meta: SearchPageMeta | null;
};

export default function SearchView({
  status,
  q,
  products,
  meta,
}: SearchViewProps) {
  const router = useRouter();
  const { language, t, isRTL } = useLanguage();
  const [draft, setDraft] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const next = draft.trim();
    router.push(searchPageHref(next, 1));
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.searchPage.eyebrow}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F] mb-6">
            {t.searchPage.title}
          </h1>
          <form
            onSubmit={submit}
            className="relative max-w-xl"
            role="search"
          >
            <label htmlFor="raf-search-q" className="sr-only">
              {t.searchPage.title}
            </label>
            <input
              id="raf-search-q"
              ref={inputRef}
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.nav.search}
              className={`w-full h-12 bg-[#FAF7F2] border border-[#2D1F1F]/15 text-sm rounded-md focus:outline-none focus:border-[#C9A84C] ${
                isRTL ? 'pr-4 pl-12 text-right' : 'pl-4 pr-12'
              }`}
              autoComplete="off"
            />
            <button
              type="submit"
              className={`absolute top-1/2 -translate-y-1/2 p-2 text-[#C9A84C] hover:text-[#2D1F1F] ${
                isRTL ? 'left-2' : 'right-2'
              }`}
              aria-label={t.searchPage.submit}
            >
              <Search size={18} />
            </button>
          </form>
          {q ? (
            <p className="mt-4 text-sm text-[#2D1F1F]/45">
              {t.searchPage.resultsFor}{' '}
              <span className="font-semibold text-[#2D1F1F]">“{q}”</span>
              {status === 'ok' && meta ? (
                <span>
                  {' '}
                  · {meta.total} {t.filters.results}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="mt-4 text-sm text-[#2D1F1F]/45">
              {t.searchPage.hint}
            </p>
          )}
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        {status === 'idle' ? (
          <p className="text-sm text-[#2D1F1F]/40 text-center py-16">
            {t.searchPage.hint}
          </p>
        ) : null}

        {status === 'invalid' ? (
          <div className="text-center py-16">
            <p className="text-sm text-[#2D1F1F]/55 mb-4">
              {t.searchPage.invalid}
            </p>
            <Link
              href="/search"
              className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C]"
            >
              {t.searchPage.clear}
            </Link>
          </div>
        ) : null}

        {status === 'unavailable' ? (
          <div className="text-center py-16">
            <p className="text-sm text-[#2D1F1F]/55 mb-4">
              {t.searchPage.unavailable}
            </p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C]"
            >
              {t.common.retry}
            </button>
          </div>
        ) : null}

        {status === 'data-error' ? (
          <p className="text-sm text-[#2D1F1F]/55 text-center py-16">
            {t.searchPage.dataError}
          </p>
        ) : null}

        {status === 'empty' ? (
          <p className="text-sm text-[#2D1F1F]/40 text-center py-16">
            {t.searchPage.noResults}
          </p>
        ) : null}

        {status === 'ok' ? (
          <>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => {
                const href = `/products/${product.slug ?? product.id}`;
                return (
                  <li key={product.id}>
                    <Link
                      href={href}
                      className="group block border border-[#2D1F1F]/8 rounded-xl overflow-hidden hover:border-[#C9A84C]/50 transition-colors"
                    >
                      <div className="relative aspect-[4/5] bg-[#F5F3EF]">
                        <Image
                          src={product.images[0] || '/images/placeholder-media.svg'}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 100vw, 25vw"
                          className="object-cover"
                        />
                      </div>
                      <div className={`p-4 ${isRTL ? 'text-right' : ''}`}>
                        <p className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] mb-1">
                          {language === 'ar'
                            ? (product.brandAr ?? product.brand)
                            : product.brand}
                        </p>
                        <p className="text-sm font-semibold text-[#2D1F1F] line-clamp-2 group-hover:text-[#C9A84C] transition-colors">
                          {language === 'ar'
                            ? (product.nameAr ?? product.name)
                            : product.name}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {meta && meta.lastPage > 1 ? (
              <div className="mt-10 flex items-center justify-between gap-4">
                {meta.currentPage > 1 ? (
                  <Link
                    href={searchPageHref(q, meta.currentPage - 1)}
                    className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C]"
                  >
                    {t.searchPage.prev}
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-xs text-[#2D1F1F]/45">
                  {t.searchPage.page} {meta.currentPage} / {meta.lastPage}
                </span>
                {meta.currentPage < meta.lastPage ? (
                  <Link
                    href={searchPageHref(q, meta.currentPage + 1)}
                    className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C]"
                  >
                    {t.searchPage.next}
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
