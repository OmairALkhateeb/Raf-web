'use client';

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  ListX,
  MapPin,
  Package,
  PackageOpen,
  RotateCw,
  Search,
  SearchX,
  Star,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { Product, SellerStore as SellerStoreData } from '@/types';
import ProductCard from '@/components/products/ProductCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import { deliveryCityLabel } from '@/lib/account/delivery-cities';
import { CATALOG_SORTS, type CatalogSort } from '@/lib/catalog/params';
import {
  SELLER_SEARCH_MAX,
  sellerStoreHref,
  type SellerStoreQuery,
} from '@/lib/sellers/params';

/**
 * `no-match`: a tab or search found nothing (the store has products).
 * `empty`: the store has no products at all.
 */
export type SellerProductsStatus = 'ok' | 'empty' | 'no-match' | 'beyond-page' | 'unavailable';

export interface SellerProductsMeta {
  total: number;
  currentPage: number;
  lastPage: number;
}

interface SellerStoreProps {
  store: SellerStoreData;
  query: SellerStoreQuery;
  products: Product[];
  productsStatus: SellerProductsStatus;
  meta: SellerProductsMeta | null;
}

/** Long descriptions start clamped to 3 lines with "Read more". */
const DESCRIPTION_CLAMP_CHARS = 240;
const DESCRIPTION_CLAMP_LINES = 3;

function countLabel(count: number, one: string, other: string): string {
  return (count === 1 ? one : other).replace('{count}', String(count));
}

export default function SellerStore({ store, query, products, productsStatus, meta }: SellerStoreProps) {
  const { language, t, isRTL } = useLanguage();
  const copy = t.seller;
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const href = (overrides: Partial<SellerStoreQuery>) =>
    sellerStoreHref(store.slug, { ...query, page: 1, ...overrides });
  const go = (target: string) => startTransition(() => router.push(target, { scroll: false }));

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    go(href({ q: value || undefined }));
  };

  const sortLabels: Record<CatalogSort, string> = {
    newest: t.filters.sortOptions.newest,
    price_asc: t.filters.sortOptions.priceAsc,
    price_desc: t.filters.sortOptions.priceDesc,
    bestselling: t.filters.sortOptions.bestselling,
    rating: t.filters.sortOptions.rating,
  };

  const chip = (active: boolean) =>
    `shrink-0 px-4 py-2 rounded-full border text-[12px] font-semibold transition-colors ${
      active
        ? 'border-[#2D1F1F] bg-[#2D1F1F] text-white'
        : 'border-[#2D1F1F]/15 text-[#2D1F1F]/60 hover:border-[#2D1F1F]/40'
    }`;
  const filtered = query.categoryId !== undefined || !!query.q;

  const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';
  const initial = Array.from(store.name.trim())[0]?.toUpperCase() ?? '';

  const city = store.city ? deliveryCityLabel(store.city, t, undefined, language) : undefined;

  // Muscat time, so the server and the browser print the same month.
  const joined = store.joinedAt
    ? new Date(store.joinedAt).toLocaleDateString(language === 'ar' ? 'ar-OM' : 'en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Muscat',
      })
    : undefined;

  const description = store.description;
  const longDescription =
    !!description &&
    (description.length > DESCRIPTION_CLAMP_CHARS ||
      description.split('\n').length > DESCRIPTION_CLAMP_LINES);

  const rating = store.rating.toFixed(1);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header: breadcrumb, logo, name, rating */}
      <section className="bg-[#2D1F1F]">
        <div className={`${cx} pt-5 pb-10 sm:pb-12`}>
          <nav className="flex items-center gap-2 text-[11px] font-semibold text-white/70">
            <Link href="/" className="hit-area-y hover:text-[#C9A84C] transition-colors">
              {t.nav.home}
            </Link>
            <ChevronRight size={11} className={isRTL ? 'rotate-180' : ''} />
            <span className="text-[#C9A84C] truncate">{store.name}</span>
          </nav>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
            <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-white shadow-[0_12px_32px_rgba(0,0,0,0.25)] ring-1 ring-black/5 overflow-hidden rounded-xl flex items-center justify-center">
              {store.logo ? (
                <Image
                  src={store.logo}
                  alt={store.name}
                  width={112}
                  height={112}
                  className="w-full h-full object-contain"
                  priority
                />
              ) : (
                <span aria-hidden className="font-serif font-semibold text-[#2D1F1F] text-4xl sm:text-5xl">
                  {initial}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-2">
                {copy.storeEyebrow}
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-white break-words">
                {store.name}
              </h1>
              <div className="mt-3 flex items-center gap-2 text-sm text-white/75">
                {store.reviewCount > 0 ? (
                  <>
                    <Star
                      size={15}
                      className="fill-[#C9A84C] text-[#C9A84C]"
                      aria-label={copy.ratingAria.replace('{rating}', rating)}
                    />
                    <span dir="ltr" className="font-semibold text-white">{rating}</span>
                    <span className="text-white/60">
                      ({countLabel(store.reviewCount, copy.reviewCountOne, copy.reviewCountOther)})
                    </span>
                  </>
                ) : (
                  <span className="text-white/60">{copy.noReviews}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Facts and description */}
      <section className="bg-white border-b border-[#2D1F1F]/8">
        <div className={`${cx} py-7 flex flex-col lg:flex-row lg:items-start gap-5 lg:gap-10`}>
          {description ? (
            <div className="flex-1 max-w-2xl">
              <p
                dir="auto"
                className={`text-[#2D1F1F]/70 text-sm leading-relaxed whitespace-pre-line text-start ${
                  longDescription && !expanded ? 'line-clamp-3' : ''
                }`}
              >
                {description}
              </p>
              {longDescription && (
                <button
                  type="button"
                  onClick={() => setExpanded((open) => !open)}
                  aria-expanded={expanded}
                  className="mt-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#2D1F1F] hover:text-[#C9A84C] transition-colors"
                >
                  {expanded ? copy.readLess : copy.readMore}
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <ul className="flex flex-wrap items-center gap-x-6 gap-y-3 flex-shrink-0 text-[#2D1F1F]/60 text-[13px] font-semibold">
            {city && (
              <li className="flex items-center gap-2">
                <MapPin size={15} className="text-[#C9A84C]" />
                {city}
              </li>
            )}
            {joined && (
              <li className="flex items-center gap-2">
                <CalendarDays size={15} className="text-[#C9A84C]" />
                {copy.memberSince.replace('{date}', joined)}
              </li>
            )}
            <li className="flex items-center gap-2">
              <Package size={15} className="text-[#C9A84C]" />
              {countLabel(store.productCount, copy.productCountOne, copy.productCountOther)}
            </li>
          </ul>
        </div>
      </section>

      {/* Products: category tabs, search, sort, pages — all kept in the URL. */}
      <section className="bg-[#FAF7F2]">
        <div className={`${cx} py-12 sm:py-16`}>
          <h2 className="text-2xl font-serif text-[#2D1F1F] mb-6">{copy.productsHeading}</h2>

          {/* No toolbar when there's nothing to filter, or the products can't load. */}
          {productsStatus !== 'empty' && productsStatus !== 'unavailable' && (
            <div className="mb-8 flex flex-col gap-4">
              {store.categories.length > 0 && (
                <nav
                  aria-label={copy.categoryTabs}
                  className="-mx-6 px-6 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto pb-1"
                >
                  <Link
                    href={href({ categoryId: undefined })}
                    scroll={false}
                    aria-current={query.categoryId === undefined ? 'page' : undefined}
                    className={chip(query.categoryId === undefined)}
                  >
                    {copy.allTab}
                  </Link>
                  {store.categories.map((category) => (
                    <Link
                      key={category.id}
                      href={href({ categoryId: category.id })}
                      scroll={false}
                      aria-current={query.categoryId === category.id ? 'page' : undefined}
                      className={chip(query.categoryId === category.id)}
                    >
                      {pickLocalized(language, category.name, category.nameAr)}
                    </Link>
                  ))}
                </nav>
              )}

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <form role="search" onSubmit={onSearch} className="relative flex-1 sm:max-w-md">
                  <label htmlFor="seller-search" className="sr-only">
                    {copy.searchLabel}
                  </label>
                  <Search
                    size={16}
                    aria-hidden
                    className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#2D1F1F]/40 pointer-events-none"
                  />
                  <input
                    key={query.q ?? ''}
                    id="seller-search"
                    name="q"
                    type="search"
                    defaultValue={query.q ?? ''}
                    maxLength={SELLER_SEARCH_MAX}
                    placeholder={copy.searchPlaceholder}
                    className="w-full h-11 rounded-md border border-[#2D1F1F]/15 bg-white ps-10 pe-10 text-sm text-[#2D1F1F] placeholder:text-[#2D1F1F]/40 focus:outline-none focus:border-[#C9A84C]"
                  />
                  {query.q && (
                    <Link
                      href={href({ q: undefined })}
                      scroll={false}
                      aria-label={copy.clearSearch}
                      className="absolute top-1/2 -translate-y-1/2 end-2 w-7 h-7 flex items-center justify-center rounded-full text-[#2D1F1F]/50 hover:text-[#2D1F1F] hover:bg-[#2D1F1F]/5"
                    >
                      <X size={14} />
                    </Link>
                  )}
                </form>

                <label className="flex items-center gap-2 text-[12px] font-semibold text-[#2D1F1F]/60 sm:ms-auto">
                  {t.filters.sort}
                  <select
                    value={query.sort}
                    onChange={(event) => go(href({ sort: event.target.value as CatalogSort }))}
                    className="h-11 rounded-md border border-[#2D1F1F]/15 bg-white px-3 text-sm text-[#2D1F1F] focus:outline-none focus:border-[#C9A84C]"
                  >
                    {CATALOG_SORTS.map((option) => (
                      <option key={option} value={option}>
                        {sortLabels[option]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          <div className={isPending ? 'opacity-50 transition-opacity' : 'transition-opacity'} aria-busy={isPending}>
            {productsStatus === 'unavailable' && (
              <StatusCard
                icon={CloudOff}
                title={copy.productsUnavailable}
                hint={copy.productsUnavailableHint}
                primary={
                  <button
                    type="button"
                    onClick={() => startTransition(() => router.refresh())}
                    disabled={isPending}
                    className={PRIMARY_BUTTON}
                  >
                    <RotateCw size={14} aria-hidden className={isPending ? 'animate-spin' : ''} />
                    {copy.tryAgain}
                  </button>
                }
                secondary={
                  <Link href="/products" className={SECONDARY_BUTTON}>
                    {copy.browseProducts}
                  </Link>
                }
              />
            )}

            {productsStatus === 'empty' && (
              <StatusCard
                icon={PackageOpen}
                title={copy.emptyProducts}
                hint={copy.emptyProductsHint}
                secondary={
                  <Link href="/products" className={SECONDARY_BUTTON}>
                    {copy.browseProducts}
                  </Link>
                }
              />
            )}

            {productsStatus === 'no-match' && (
              <StatusCard
                icon={SearchX}
                title={copy.noMatch}
                hint={copy.noMatchHint}
                primary={
                  filtered ? (
                    <Link href={sellerStoreHref(store.slug, { sort: query.sort })} scroll={false} className={PRIMARY_BUTTON}>
                      {copy.clearFilters}
                    </Link>
                  ) : undefined
                }
              />
            )}

            {productsStatus === 'beyond-page' && (
              <StatusCard
                icon={ListX}
                title={copy.emptyPage}
                hint={copy.emptyPageHint}
                primary={
                  <Link href={href({ page: 1 })} scroll={false} className={PRIMARY_BUTTON}>
                    {copy.backToFirstPage}
                  </Link>
                }
              />
            )}

            {productsStatus === 'ok' && (
              <>
                <div className="grid gap-x-5 gap-y-10 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {products.map((product, i) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ delay: (i % 5) * 0.05, duration: 0.4 }}
                    >
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </div>

                {meta && meta.lastPage > 1 && (
                  <nav className="mt-14 flex items-center justify-center gap-2" aria-label={t.catalog.pagination}>
                    {meta.currentPage > 1 && (
                      <Link
                        href={href({ page: meta.currentPage - 1 })}
                        className="w-10 h-10 border border-[#2D1F1F]/15 rounded-md flex items-center justify-center text-[#2D1F1F]/60 hover:border-[#C9A84C]"
                        aria-label={t.catalog.previousPage}
                      >
                        <ChevronLeft size={16} className={isRTL ? 'rotate-180' : ''} />
                      </Link>
                    )}
                    <span dir="ltr" className="px-4 text-sm text-[#2D1F1F]/55">
                      {meta.currentPage} / {meta.lastPage}
                    </span>
                    {meta.currentPage < meta.lastPage && (
                      <Link
                        href={href({ page: meta.currentPage + 1 })}
                        className="w-10 h-10 border border-[#2D1F1F]/15 rounded-md flex items-center justify-center text-[#2D1F1F]/60 hover:border-[#C9A84C]"
                        aria-label={t.catalog.nextPage}
                      >
                        <ChevronRight size={16} className={isRTL ? 'rotate-180' : ''} />
                      </Link>
                    )}
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 min-h-11 px-7 py-3 text-center rounded-md text-[11px] font-black tracking-[0.2em] uppercase transition-colors duration-300 disabled:opacity-60 disabled:cursor-wait';
const PRIMARY_BUTTON = `${BUTTON_BASE} bg-[#2D1F1F] text-white hover:bg-[#C9A84C]`;
const SECONDARY_BUTTON = `${BUTTON_BASE} border border-[#2D1F1F]/15 text-[#2D1F1F] hover:border-[#C9A84C] hover:text-[#C9A84C]`;

/** A message card in the products area (error, empty, no match, past the last page). */
function StatusCard({
  icon: Icon,
  title,
  hint,
  primary,
  secondary,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  primary?: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="mx-auto max-w-xl rounded-2xl border border-[#2D1F1F]/8 bg-white px-6 py-12 sm:px-12 sm:py-14 text-center shadow-[0_8px_30px_rgba(45,31,31,0.04)]"
    >
      <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-[#C9A84C]/10 ring-1 ring-[#C9A84C]/25 flex items-center justify-center">
        <Icon size={26} strokeWidth={1.6} aria-hidden className="text-[#C9A84C]" />
      </div>
      <h3 className="font-serif text-xl sm:text-2xl text-[#2D1F1F]">{title}</h3>
      {hint ? <p className="mt-3 text-sm leading-relaxed text-[#2D1F1F]/55">{hint}</p> : null}
      {primary || secondary ? (
        <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          {primary}
          {secondary}
        </div>
      ) : null}
    </div>
  );
}
