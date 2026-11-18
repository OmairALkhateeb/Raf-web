'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Package, Search } from 'lucide-react';
import { Brand } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import CountrySelect from '@/components/common/CountrySelect';
import {
  brandDirectoryHref,
  brandDirectoryHrefResetPage,
  hasActiveBrandDirectoryFilters,
  type BrandDirectoryQuery,
  type BrandDirectorySort,
} from '@/lib/brands/params';

export type BrandsIndexStatus =
  | 'ok'
  | 'empty'
  | 'unavailable'
  | 'data-error'
  | 'no-matching'
  | 'invalid'
  | 'beyond-page';

export interface BrandDirectoryMeta {
  total: number;
  currentPage: number;
  lastPage: number;
  perPage: number;
}

interface BrandsIndexProps {
  status: BrandsIndexStatus;
  brands: Brand[];
  query: BrandDirectoryQuery;
  meta: BrandDirectoryMeta | null;
  tracking: Record<string, string>;
}

const controlClass =
  'w-full h-11 px-4 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';

function trackingParams(tracking: Record<string, string>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(tracking)) sp.set(key, value);
  return sp;
}

function formatBrandProductCountDigits(count: number): string {
  return new Intl.NumberFormat('en-GB').format(count);
}

function formatBrandProductCountLabel(
  count: number,
  one: string,
  other: string,
): string {
  const template = count === 1 ? one : other;
  return template.replace('{count}', formatBrandProductCountDigits(count));
}

export default function BrandsIndex({
  status,
  brands,
  query,
  meta,
  tracking,
}: BrandsIndexProps) {
  const router = useRouter();
  const { language, t, isRTL } = useLanguage();
  const copy = t.brand;
  const committedName = query.name ?? '';
  const [nameDraft, setNameDraft] = useState(committedName);
  const [nameSource, setNameSource] = useState(committedName);
  if (committedName !== nameSource) {
    setNameSource(committedName);
    setNameDraft(committedName);
  }
  const track = useMemo(() => trackingParams(tracking), [tracking]);
  const filtersActive = hasActiveBrandDirectoryFilters(query);
  const firstPageHref = brandDirectoryHref(query, track, { page: 1 });

  const applyNameSearch = (raw: string) => {
    const name = raw.trim() || undefined;
    router.replace(brandDirectoryHrefResetPage(query, track, { name }), {
      scroll: false,
    });
  };

  const sortOptions: { value: '' | BrandDirectorySort; label: string }[] = [
    { value: '', label: copy.sortDefault },
    { value: 'name', label: copy.sortNameAsc },
    { value: '-name', label: copy.sortNameDesc },
    { value: 'products_count', label: copy.sortProductsAsc },
    { value: '-products_count', label: copy.sortProductsDesc },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="bg-[#FAF7F2] min-h-screen">
      <section className="bg-[#2D1F1F] text-white">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-20 text-center">
          <span className="block text-[10px] font-black tracking-[0.45em] uppercase text-[#C9A84C] mb-4">
            {copy.stores}
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif">
            {copy.shopByBrand}
          </h1>
          <p className="text-white/45 text-sm mt-4 max-w-md mx-auto">
            {copy.directorySubtitle}
          </p>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-12 sm:py-16">
        <div className="mb-8 bg-white border border-[#2D1F1F]/8 rounded-2xl p-4 sm:p-5">
          <form
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 sm:gap-4 items-end"
            action="/brands"
            method="get"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              applyNameSearch(String(formData.get('name') ?? ''));
            }}
          >
            <div className="sm:col-span-2 xl:col-span-1">
              <label htmlFor="brand-directory-name" className="block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2">
                {copy.nameSearchLabel}
              </label>
              <div className="flex gap-2">
                <input
                  id="brand-directory-name"
                  name="name"
                  type="search"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  placeholder={copy.nameSearchPlaceholder}
                  className={controlClass}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="h-11 px-4 flex-shrink-0 bg-[#2D1F1F] text-white rounded-md hover:bg-[#C9A84C] hover:text-[#2D1F1F] transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]"
                  aria-label={copy.applySearch}
                >
                  <Search size={16} />
                  <span className="text-[11px] font-black tracking-[0.14em] uppercase hidden sm:inline">
                    {copy.applySearch}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="brand-directory-country" className="block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2">
                {copy.countryFilterLabel}
              </label>
              <CountrySelect
                id="brand-directory-country"
                value={query.country ?? ''}
                onChange={(code) => {
                  router.replace(
                    brandDirectoryHrefResetPage(query, track, {
                      country: code || undefined,
                    }),
                    { scroll: false },
                  );
                }}
                language={language}
                placeholder={copy.allCountries}
                extraCode={query.country ?? null}
                allowEmpty
              />
            </div>

            <div>
              <label htmlFor="brand-directory-sort" className="block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2">
                {copy.sortLabel}
              </label>
              <select
                id="brand-directory-sort"
                name="sort"
                value={query.sort ?? ''}
                onChange={(event) => {
                  const next = event.target.value;
                  router.replace(
                    brandDirectoryHrefResetPage(query, track, {
                      sort: next
                        ? (next as BrandDirectorySort)
                        : undefined,
                    }),
                    { scroll: false },
                  );
                }}
                className={controlClass}
              >
                {sortOptions.map((option) => (
                  <option key={option.value || 'default'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {filtersActive ? (
              <Link
                href="/brands"
                className="h-11 px-4 inline-flex items-center justify-center text-[11px] font-black tracking-[0.14em] uppercase text-[#2D1F1F] border border-[#2D1F1F]/15 rounded-md hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]"
              >
                {copy.clearFilters}
              </Link>
            ) : (
              <span className="hidden xl:block h-11" aria-hidden="true" />
            )}
          </form>
        </div>

        {status === 'unavailable' && (
          <StatusBlock title={copy.unavailable} hint={copy.unavailableHint} />
        )}
        {status === 'data-error' && (
          <StatusBlock title={copy.dataError} hint={copy.dataErrorHint} />
        )}
        {status === 'invalid' && (
          <StatusBlock
            title={copy.invalidDirectory}
            hint={copy.invalidDirectoryHint}
            href="/brands"
            label={copy.clearFilters}
          />
        )}
        {status === 'empty' && (
          <StatusBlock title={copy.emptyDirectory} />
        )}
        {status === 'no-matching' && (
          <StatusBlock
            title={copy.noMatching}
            hint={copy.noMatchingHint}
            href="/brands"
            label={copy.clearFilters}
          />
        )}
        {status === 'beyond-page' && (
          <StatusBlock
            title={copy.emptyDirectoryPage}
            href={firstPageHref}
            label={copy.backToFirstPage}
          />
        )}

        {status === 'ok' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {brands.map((brand, i) => {
                const name = pickLocalized(language, brand.name, brand.nameAr);
                const description = pickLocalized(
                  language,
                  brand.description,
                  brand.descriptionAr,
                );
                const productCountDigits = formatBrandProductCountDigits(brand.productCount);
                const productCountLabel = formatBrandProductCountLabel(
                  brand.productCount,
                  copy.productCountOne,
                  copy.productCountOther,
                );
                return (
                  <motion.div
                    key={brand.id}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: (i % 3) * 0.08, duration: 0.45 }}
                    className="h-full"
                  >
                    <Link
                      href={`/brands/${brand.slug}`}
                      className="group flex flex-col h-full bg-white overflow-hidden shadow-[0_2px_24px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-shadow duration-300 rounded-2xl"
                      aria-label={`${copy.visitStore}: ${name}. ${productCountLabel}`}
                    >
                      <div className="relative h-36 overflow-hidden bg-[#2D1F1F]">
                        {brand.banner && (
                          <Image src={brand.banner} alt={name} fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover opacity-60 transition-transform duration-500 group-hover:scale-105" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      </div>
                      <div className="px-6 pb-6 flex flex-col flex-1">
                        <div className="w-16 h-16 -mt-9 mb-3 bg-white shadow-md ring-1 ring-black/5 overflow-hidden rounded-lg flex items-center justify-center relative z-10">
                          {brand.logo ? (
                            <Image src={brand.logo} alt={name} width={64} height={64} className="w-full h-full object-contain" />
                          ) : (
                            <span className="font-serif font-semibold text-[#2D1F1F] text-center leading-tight px-1 text-sm">
                              {name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="min-w-0 flex-1 text-lg font-serif text-[#2D1F1F] group-hover:text-[#C9A84C] transition-colors">
                            {name}
                          </h2>
                          <span
                            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#C9A84C]/10 text-[#2D1F1F] text-[11px] font-semibold tabular-nums"
                            aria-label={productCountLabel}
                          >
                            <Package
                              size={13}
                              strokeWidth={2}
                              className="text-[#C9A84C] shrink-0"
                              aria-hidden="true"
                            />
                            {productCountDigits}
                          </span>
                        </div>
                        <p
                          className={`text-[#2D1F1F]/55 text-[13px] leading-relaxed mt-2 line-clamp-2 min-h-[2.625rem] ${description ? '' : 'invisible'}`}
                        >
                          {description || '\u00a0'}
                        </p>
                        <div className="mt-auto pt-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-[0.15em] uppercase text-[#2D1F1F] group-hover:text-[#C9A84C] transition-colors">
                            {copy.visitStore}
                            <ArrowRight size={13} className={isRTL ? 'rotate-180' : ''} />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {meta && meta.lastPage > 1 && (
              <nav
                className="mt-14 flex items-center justify-center gap-2"
                aria-label={t.catalog.pagination}
              >
                {meta.currentPage > 1 ? (
                  <Link
                    href={brandDirectoryHref(query, track, {
                      page: meta.currentPage - 1,
                    })}
                    className="w-10 h-10 border border-[#2D1F1F]/15 rounded-md flex items-center justify-center text-[#2D1F1F]/60 hover:border-[#C9A84C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]"
                    aria-label={t.catalog.previousPage}
                  >
                    <ChevronLeft size={16} className={isRTL ? 'rotate-180' : ''} />
                  </Link>
                ) : null}
                <span className="px-4 text-sm text-[#2D1F1F]/55">
                  {meta.currentPage} / {meta.lastPage}
                </span>
                {meta.currentPage < meta.lastPage ? (
                  <Link
                    href={brandDirectoryHref(query, track, {
                      page: meta.currentPage + 1,
                    })}
                    className="w-10 h-10 border border-[#2D1F1F]/15 rounded-md flex items-center justify-center text-[#2D1F1F]/60 hover:border-[#C9A84C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]"
                    aria-label={t.catalog.nextPage}
                  >
                    <ChevronRight size={16} className={isRTL ? 'rotate-180' : ''} />
                  </Link>
                ) : null}
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function StatusBlock({
  title,
  hint,
  href,
  label,
}: {
  title: string;
  hint?: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="py-24 text-center">
      <p className="text-lg font-serif text-[#2D1F1F]">{title}</p>
      {hint ? <p className="text-[#2D1F1F]/45 text-sm mt-2">{hint}</p> : null}
      {href && label ? (
        <Link
          href={href}
          className="inline-block mt-8 text-[11px] font-black tracking-[0.2em] uppercase text-[#2D1F1F] hover:text-[#C9A84C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]"
        >
          {label}
        </Link>
      ) : null}
    </div>
  );
}
