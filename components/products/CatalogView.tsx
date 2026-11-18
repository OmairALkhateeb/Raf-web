'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SlidersHorizontal, X, ChevronDown, Check, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductCard from '@/components/products/ProductCard';
import QuickViewModal from '@/components/products/QuickViewModal';
import type { Banner, Brand, Category, Product } from '@/types';
import BannerSection from '@/components/home/BannerSection';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import {
  brandSlugs,
  CATALOG_SORTS,
  catalogHref,
  type CatalogHrefOverrides,
  catalogHrefResetPage,
  type CatalogQuery,
  type CatalogSort,
  clearFiltersQuery,
  toggleAttributeValue,
} from '@/lib/catalog/params';
import type { CatalogCategoryDetail } from '@/lib/mappers/catalog';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

export type CatalogStatus =
  | 'ok'
  | 'empty'
  | 'invalid'
  | 'unavailable'
  | 'data-error'
  | 'not-found';

export interface CatalogMeta {
  total: number;
  currentPage: number;
  lastPage: number;
  perPage: number;
}

export interface CatalogViewProps {
  status: CatalogStatus;
  products: Product[];
  categories: Category[];
  brands: Brand[];
  query: CatalogQuery;
  meta: CatalogMeta | null;
  tracking: Record<string, string>;
  categoriesFailed: boolean;
  brandsFailed: boolean;
  /** Verified category from GET /api/public/categories/{slug}. */
  categoryDetail?: CatalogCategoryDetail | null;
  /** `placement=category_page` banners (the backend has no per-category targeting). */
  banners?: Banner[];
}

function trackingParams(tracking: Record<string, string>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(tracking)) sp.set(key, value);
  return sp;
}

function findRoot(categories: Category[], slug?: string): Category | undefined {
  if (!slug) return undefined;
  return (
    categories.find(c => c.slug === slug) ??
    categories.find(c => (c.subCategories ?? []).some(s => s.slug === slug))
  );
}

export default function CatalogView({
  status,
  products,
  categories,
  brands,
  query,
  meta,
  tracking,
  categoriesFailed,
  brandsFailed,
  categoryDetail = null,
  banners = [],
}: CatalogViewProps) {
  const router = useRouter();
  const { language, t, isRTL } = useLanguage();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['brand', 'price', 'rating', 'stock']));
  // Attribute groups change with the category, so they're open unless closed here.
  const [closedAttributeGroups, setClosedAttributeGroups] = useState<Set<string>>(new Set());
  const [brandSearch, setBrandSearch] = useState('');
  const minPriceRef = useRef<HTMLInputElement>(null);
  const maxPriceRef = useRef<HTMLInputElement>(null);

  const track = useMemo(() => trackingParams(tracking), [tracking]);

  const replaceFilters = useCallback(
    (overrides: CatalogHrefOverrides) => {
      router.replace(catalogHrefResetPage(query, track, overrides), { scroll: false });
    },
    [query, router, track],
  );

  const currentRoot = findRoot(categories, query.category);
  const childRail = currentRoot?.subCategories ?? [];
  const showChildRail = childRail.length > 0;
  const ar = language === 'ar';
  const catName = (c: { name: string; nameAr?: string }) => (ar ? c.nameAr : c.name) ?? c.name;

  const pageTitle = query.ids?.length
    ? t.catalog.offerTitle
    : query.search
    ? `"${query.search}"`
    : categoryDetail
      ? (ar && categoryDetail.nameAr) || categoryDetail.name
      : currentRoot
        ? query.category && query.category !== currentRoot.slug
          ? catName(
              childRail.find((s) => s.slug === query.category) ?? currentRoot,
            )
          : catName(currentRoot)
        : t.nav.products;

  const categoryDescription =
    (language === 'ar' ? categoryDetail?.descriptionAr?.trim() : null) ||
    categoryDetail?.description?.trim() ||
    null;
  const filterName = (filter: { name: string; nameAr: string | null }) =>
    pickLocalized(language, filter.name, filter.nameAr);
  const optionLabel = (code: string, value: string) => {
    const labels = attributeFiltersByCode.get(code)?.optionLabels[value];
    return labels ? pickLocalized(language, labels.label, labels.labelAr) : value;
  };

  const priceActive = query.minPrice !== undefined || query.maxPrice !== undefined;
  const selectedBrands = brandSlugs(query.brand);
  const toggleBrand = (slug: string) => {
    const next = selectedBrands.includes(slug)
      ? selectedBrands.filter((s) => s !== slug)
      : [...selectedBrands, slug];
    replaceFilters({ brand: next.length ? next.join(',') : undefined });
  };
  const attributeFilters = categoryDetail?.filters ?? [];
  const attributeFiltersByCode = new Map(attributeFilters.map((filter) => [filter.code, filter]));
  const selectedAttributes = query.attributes ?? {};
  const activeCount =
    selectedBrands.length +
    (query.onSale ? 1 : 0) +
    (query.search ? 1 : 0) +
    (priceActive ? 1 : 0) +
    (query.minRating !== undefined ? 1 : 0) +
    (query.inStock ? 1 : 0) +
    Object.keys(selectedAttributes).length;

  const toggleAttribute = (code: string, value: string) =>
    replaceFilters({ attributes: toggleAttributeValue(query.attributes, code, value) });

  const sortLabels: Record<CatalogSort, string> = {
    newest: t.filters.sortOptions.newest,
    price_asc: t.filters.sortOptions.priceAsc,
    price_desc: t.filters.sortOptions.priceDesc,
    bestselling: t.filters.sortOptions.bestselling,
    rating: t.filters.sortOptions.rating,
  };

  const allProductsHref = catalogHrefResetPage(query, track, { category: null, brand: undefined, search: undefined, minPrice: undefined, maxPrice: undefined, minRating: undefined, inStock: false, onSale: false, ids: undefined, sort: 'newest' });
  const clearFiltersHref = catalogHref(clearFiltersQuery(query), track);

  // Each brand lists the categories it sells in (parents included): with a
  // category chosen, offer only those brands. The selected brand stays so it
  // can be unticked; brands without the list (older API) always show.
  const selectedCategory = query.category;
  const categoryBrands = selectedCategory
    ? brands.filter(b =>
        !b.categorySlugs || selectedBrands.includes(b.slug) || b.categorySlugs.includes(selectedCategory),
      )
    : brands;

  const filteredBrands = categoryBrands.filter(b => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return true;
    return b.name.toLowerCase().includes(q) || (b.nameAr ?? '').toLowerCase().includes(q);
  });

  const toggleGroup = (key: string) =>
    key.startsWith('attr-')
      ? setClosedAttributeGroups(prev => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        })
      : setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const applyPrice = () => {
    const minRaw = minPriceRef.current?.value.trim() ?? '';
    const maxRaw = maxPriceRef.current?.value.trim() ?? '';
    const min = minRaw === '' ? undefined : Number(minRaw);
    const max = maxRaw === '' ? undefined : Number(maxRaw);
    if (min !== undefined && !Number.isFinite(min)) return;
    if (max !== undefined && !Number.isFinite(max)) return;
    replaceFilters({ minPrice: min, maxPrice: max });
  };

  const renderAccordion = (groupKey: string, title: string, count: number, body: ReactNode) => {
    const open = groupKey.startsWith('attr-')
      ? !closedAttributeGroups.has(groupKey)
      : openGroups.has(groupKey);
    return (
      <div key={groupKey} className="border-b border-[#2D1F1F]/8">
        <button type="button" onClick={() => toggleGroup(groupKey)} className="w-full flex items-center justify-between py-4">
          <span className="flex items-center gap-2 text-[13px] font-bold text-[#2D1F1F]">
            {title}
            {count > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-md bg-[#C9A84C] text-white text-[10px] font-black flex items-center justify-center">
                {count}
              </span>
            )}
          </span>
          <ChevronDown size={16} className={`text-[#2D1F1F]/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="pb-4">{body}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderOption = (rowKey: string, active: boolean, label: string, onToggle: () => void, radio?: boolean) => (
    <label key={rowKey} className="flex items-center justify-between py-2 cursor-pointer group">
      <span className="text-[13px] text-[#2D1F1F]/75 group-hover:text-[#2D1F1F] transition-colors">{label}</span>
      <span className={`w-[18px] h-[18px] flex-shrink-0 ${radio ? 'rounded-full' : 'rounded-sm'} border flex items-center justify-center transition-colors ${active ? 'border-[#C9A84C] bg-[#C9A84C]' : 'border-[#2D1F1F]/25 group-hover:border-[#C9A84C]'}`}>
        {active && (radio ? <span className="w-2 h-2 rounded-full bg-white" /> : <Check size={11} className="text-white" />)}
      </span>
      <input type={radio ? 'radio' : 'checkbox'} className="sr-only" checked={active} onChange={onToggle} />
    </label>
  );

  const filterPanelContent = (
    <div>
      {!brandsFailed && categoryBrands.length > 0 && renderAccordion('brand', t.filters.brands, selectedBrands.length, (
        <>
          <div className="relative mb-2">
            <Search size={14} className={`absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/30 ${isRTL ? 'right-3' : 'left-3'}`} />
            <input
              value={brandSearch}
              onChange={e => setBrandSearch(e.target.value)}
              placeholder={t.catalog.searchPlaceholder}
              className={`w-full h-9 bg-[#FAF7F2] border border-[#2D1F1F]/10 text-[13px] rounded-md focus:outline-none focus:border-[#C9A84C] ${isRTL ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3'}`}
            />
          </div>
          <div className={filteredBrands.length > 7 ? 'max-h-56 overflow-y-auto pe-1' : ''}>
            {filteredBrands.map(brand =>
              renderOption(
                brand.id,
                selectedBrands.includes(brand.slug),
                catName(brand),
                () => toggleBrand(brand.slug),
                true,
              ),
            )}
          </div>
        </>
      ))}

      {renderAccordion('price', t.filters.priceRange, priceActive ? 1 : 0, (
        <div className="flex items-center gap-2 pt-1">
          <input
            key={`min-${query.minPrice ?? ''}`}
            ref={minPriceRef}
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={t.catalog.minPrice}
            defaultValue={query.minPrice ?? ''}
            onBlur={applyPrice}
            className="w-full h-9 px-2 text-sm border border-[#2D1F1F]/15 rounded-md focus:outline-none focus:border-[#C9A84C]"
          />
          <span className="text-[#2D1F1F]/30 text-xs">—</span>
          <input
            key={`max-${query.maxPrice ?? ''}`}
            ref={maxPriceRef}
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={t.catalog.maxPrice}
            defaultValue={query.maxPrice ?? ''}
            onBlur={applyPrice}
            className="w-full h-9 px-2 text-sm border border-[#2D1F1F]/15 rounded-md focus:outline-none focus:border-[#C9A84C]"
          />
        </div>
      ))}

      {attributeFilters.map(filter =>
        renderAccordion(
          `attr-${filter.code}`,
          filterName(filter),
          selectedAttributes[filter.code]?.length ?? 0,
          <div>
            {filter.options.map(option =>
              renderOption(
                `attr-${filter.code}-${option}`,
                selectedAttributes[filter.code]?.includes(option) ?? false,
                optionLabel(filter.code, option),
                () => toggleAttribute(filter.code, option),
              ),
            )}
          </div>,
        ),
      )}

      {renderAccordion('rating', t.catalog.rating, query.minRating !== undefined ? 1 : 0, (
        <div>
          {[4, 3, 2].map(value =>
            renderOption(
              `rating-${value}`,
              query.minRating === value,
              `${value} ★ ${t.catalog.ratingAndUp}`,
              () => replaceFilters({ minRating: query.minRating === value ? undefined : value }),
              true,
            ),
          )}
        </div>
      ))}

      {renderAccordion('stock', t.catalog.availability, (query.inStock ? 1 : 0) + (query.onSale ? 1 : 0), (
        <div>
          {renderOption(
            'in-stock',
            query.inStock,
            t.catalog.inStockOnly,
            () => replaceFilters({ inStock: !query.inStock }),
          )}
          {renderOption(
            'on-sale',
            query.onSale,
            t.catalog.onSaleOnly,
            () => replaceFilters({ onSale: !query.onSale }),
          )}
        </div>
      ))}
    </div>
  );

  const messageBlock = (title: string, body: string, action?: { href: string; label: string }) => (
    <div className="py-28 text-center">
      <p className="text-4xl font-serif text-[#2D1F1F]/10 mb-6">—</p>
      <h3 className="text-xl font-serif text-[#2D1F1F] mb-3">{title}</h3>
      <p className="text-[#2D1F1F]/45 text-sm mb-8">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="inline-flex px-8 py-3 border border-[#2D1F1F] rounded-md text-[11px] font-black tracking-[0.25em] uppercase text-[#2D1F1F] hover:bg-[#2D1F1F] hover:text-white transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );

  const showGrid = status === 'ok';
  const resultCount = meta?.total;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} pt-10 sm:pt-14 pb-6`}>
          {query.category ? (
            <nav className="flex items-center gap-2 text-[11px] font-semibold mb-3">
              <Link href="/" className="text-[#2D1F1F]/40 hover:text-[#C9A84C] transition-colors">
                {t.nav.home}
              </Link>
              <span className="text-[#2D1F1F]/25">/</span>
              <Link href={allProductsHref} className="text-[#2D1F1F]/40 hover:text-[#C9A84C] transition-colors">
                {t.product.backToProducts}
              </Link>
              <span className="text-[#2D1F1F]/25">/</span>
              {currentRoot && query.category !== currentRoot.slug && (
                <>
                  {/* A sub-category: its parent first (Home / Products / Parent / Child). */}
                  <Link
                    href={catalogHrefResetPage(query, track, { category: currentRoot.slug })}
                    className="text-[#2D1F1F]/40 hover:text-[#C9A84C] transition-colors"
                  >
                    {catName(currentRoot)}
                  </Link>
                  <span className="text-[#2D1F1F]/25">/</span>
                </>
              )}
              <span className="text-[#C9A84C]">{pageTitle}</span>
            </nav>
          ) : (
            <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
              {t.catalog.browseSelection}
            </span>
          )}
          <div className="flex items-end justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
                {pageTitle}
              </h1>
              {categoryDescription ? (
                <p className="mt-3 text-sm text-[#2D1F1F]/55 leading-relaxed max-w-2xl">
                  {categoryDescription}
                </p>
              ) : null}
            </div>
            {status === 'ok' && resultCount !== undefined && (
              <p className="text-[#2D1F1F]/40 text-sm pb-1 shrink-0">
                {resultCount} {t.filters.results}
              </p>
            )}
          </div>
        </div>

        {!categoriesFailed && categories.length > 0 && (
          <div className={`${cx} pb-4`}>
            <div className="flex items-center gap-2.5 overflow-x-auto hide-scrollbar">
              <Link
                href={allProductsHref}
                className={`flex items-center gap-2 h-10 px-5 text-[11px] font-bold tracking-[0.12em] uppercase whitespace-nowrap transition-all border rounded-md ${
                  !query.category ? 'border-[#2D1F1F] bg-[#2D1F1F] text-white' : 'border-[#2D1F1F]/15 text-[#2D1F1F]/60 hover:border-[#2D1F1F]/40'
                }`}
              >
                {t.catalog.all}
              </Link>
              {categories.map(cat => {
                const active = currentRoot?.id === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => replaceFilters({ category: cat.slug })}
                    className={`flex items-center gap-2 h-10 px-5 text-[11px] font-bold tracking-[0.12em] uppercase whitespace-nowrap transition-all border rounded-md ${
                      active ? 'border-[#C9A84C] bg-[#C9A84C] text-white shadow-gold' : 'border-[#2D1F1F]/15 text-[#2D1F1F]/60 hover:border-[#C9A84C] hover:text-[#2D1F1F]'
                    }`}
                  >
                    {catName(cat)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showChildRail && currentRoot && (
          <div className={`${cx} pb-5`}>
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              <button
                type="button"
                onClick={() => replaceFilters({ category: currentRoot.slug })}
                className={`h-8 px-4 text-[11px] font-semibold tracking-wide whitespace-nowrap transition-colors ${
                  query.category === currentRoot.slug ? 'text-[#C9A84C]' : 'text-[#2D1F1F]/50 hover:text-[#2D1F1F]'
                }`}
              >
                {t.catalog.allSections}
              </button>
              {childRail.map(sub => {
                const active = query.category === sub.slug;
                return (
                  <button
                    type="button"
                    key={sub.id}
                    onClick={() => replaceFilters({ category: sub.slug })}
                    className={`h-8 px-4 text-[11px] font-semibold tracking-wide whitespace-nowrap rounded-md border transition-colors ${
                      active ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-[#2D1F1F]/15 text-[#2D1F1F]/60 hover:border-[#C9A84C]'
                    }`}
                  >
                    {catName(sub)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BannerSection banners={banners} compact ratio="24/5" />

      <div className="border-b border-[#2D1F1F]/8 bg-white sticky top-[68px] z-30">
        <div className={`${cx} h-14 flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 h-9 px-4 border rounded-md text-[11px] font-bold tracking-[0.12em] uppercase transition-colors flex-shrink-0 ${
                isFilterOpen ? 'border-[#2D1F1F] bg-[#2D1F1F] text-white' : 'border-[#2D1F1F]/20 text-[#2D1F1F]/70 hover:border-[#2D1F1F]/50'
              }`}
            >
              <SlidersHorizontal size={12} />
              {t.filters.filters}
              {activeCount > 0 && (
                <span className="w-4 h-4 bg-[#C9A84C] text-white text-[9px] font-black flex items-center justify-center rounded-sm">{activeCount}</span>
              )}
            </button>

            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              {query.search && (
                <button type="button" onClick={() => replaceFilters({ search: undefined })} className="flex items-center gap-1.5 h-7 px-3 bg-[#2D1F1F]/6 text-[#2D1F1F] text-[10px] font-bold tracking-wide uppercase whitespace-nowrap rounded-md hover:bg-[#2D1F1F]/12">
                  “{query.search}” <X size={9} />
                </button>
              )}
              {selectedBrands.map((slug) => (
                <button key={`brand-chip-${slug}`} type="button" onClick={() => toggleBrand(slug)} className="flex items-center gap-1.5 h-7 px-3 bg-[#2D1F1F]/6 text-[#2D1F1F] text-[10px] font-bold tracking-wide uppercase whitespace-nowrap rounded-md hover:bg-[#2D1F1F]/12">
                  {catName(brands.find(b => b.slug === slug) ?? { name: slug })} <X size={9} />
                </button>
              ))}
              {query.onSale && (
                <button type="button" onClick={() => replaceFilters({ onSale: false })} className="flex items-center gap-1.5 h-7 px-3 bg-[#2D1F1F]/6 text-[#2D1F1F] text-[10px] font-bold tracking-wide uppercase whitespace-nowrap rounded-md hover:bg-[#2D1F1F]/12">
                  {t.catalog.onSaleOnly} <X size={9} />
                </button>
              )}
              {query.minRating !== undefined && (
                <button type="button" onClick={() => replaceFilters({ minRating: undefined })} className="flex items-center gap-1.5 h-7 px-3 bg-[#2D1F1F]/6 text-[#2D1F1F] text-[10px] font-bold tracking-wide uppercase whitespace-nowrap rounded-md hover:bg-[#2D1F1F]/12">
                  {query.minRating}★+ <X size={9} />
                </button>
              )}
              {priceActive && (
                <button type="button" onClick={() => replaceFilters({ minPrice: undefined, maxPrice: undefined })} className="flex items-center gap-1.5 h-7 px-3 bg-[#2D1F1F]/6 text-[#2D1F1F] text-[10px] font-bold tracking-wide uppercase whitespace-nowrap rounded-md hover:bg-[#2D1F1F]/12">
                  OMR {query.minPrice ?? '—'}–{query.maxPrice ?? '—'} <X size={9} />
                </button>
              )}
              {query.inStock && (
                <button type="button" onClick={() => replaceFilters({ inStock: false })} className="flex items-center gap-1.5 h-7 px-3 bg-[#2D1F1F]/6 text-[#2D1F1F] text-[10px] font-bold tracking-wide uppercase whitespace-nowrap rounded-md hover:bg-[#2D1F1F]/12">
                  {t.product.inStock} <X size={9} />
                </button>
              )}
              {Object.entries(selectedAttributes).flatMap(([code, values]) =>
                values.map(value => (
                  <button
                    key={`attr-chip-${code}-${value}`}
                    type="button"
                    onClick={() => toggleAttribute(code, value)}
                    aria-label={`${t.filters.removeFilter}: ${attributeFiltersByCode.get(code) ? filterName(attributeFiltersByCode.get(code)!) : code} ${optionLabel(code, value)}`}
                    className="flex items-center gap-1.5 h-7 px-3 bg-[#2D1F1F]/6 text-[#2D1F1F] text-[10px] font-bold tracking-wide uppercase whitespace-nowrap rounded-md hover:bg-[#2D1F1F]/12"
                  >
                    {attributeFiltersByCode.get(code) ? filterName(attributeFiltersByCode.get(code)!) : code}: {optionLabel(code, value)} <X size={9} />
                  </button>
                )),
              )}
              {activeCount > 0 && (
                <Link href={clearFiltersHref} className="h-7 px-3 text-[10px] font-bold tracking-wide uppercase text-[#C9A84C] hover:text-[#2D1F1F] whitespace-nowrap flex items-center">
                  {t.filters.clearAll}
                </Link>
              )}
            </div>
          </div>

          <div className="relative flex-shrink-0">
            <select
              value={query.sort}
              onChange={e => replaceFilters({ sort: e.target.value as CatalogSort })}
              className={`h-9 ${isRTL ? 'pr-3 pl-8' : 'pl-3 pr-8'} bg-transparent border border-[#2D1F1F]/20 rounded-md text-[11px] font-bold tracking-[0.1em] uppercase appearance-none cursor-pointer hover:border-[#C9A84C] focus:outline-none focus:border-[#C9A84C] text-[#2D1F1F]`}
            >
              {CATALOG_SORTS.map(opt => (
                <option key={opt} value={opt}>{sortLabels[opt]}</option>
              ))}
            </select>
            <ChevronDown size={10} className={`absolute top-1/2 -translate-y-1/2 pointer-events-none text-[#2D1F1F]/50 ${isRTL ? 'left-2' : 'right-2'}`} />
          </div>
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        {status === 'unavailable' && messageBlock(
          t.catalog.unavailable,
          t.catalog.unavailableHint,
        )}

        {status === 'invalid' && messageBlock(
          t.catalog.invalidFilters,
          t.catalog.invalidFiltersHint,
          { href: allProductsHref, label: t.product.backToProducts },
        )}

        {status === 'not-found' && messageBlock(
          t.catalog.categoryNotFound,
          t.catalog.categoryNotFoundHint,
          { href: allProductsHref, label: t.product.backToProducts },
        )}

        {status === 'data-error' && messageBlock(
          t.catalog.dataError,
          t.catalog.dataErrorHint,
          { href: allProductsHref, label: t.product.backToProducts },
        )}

        {status === 'empty' && messageBlock(
          t.catalog.noProducts,
          t.catalog.adjustFilters,
          { href: clearFiltersHref, label: t.filters.clearAll },
        )}

        {showGrid && (
          <>
            <motion.div layout className="grid gap-x-5 gap-y-10 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((product, i) => (
                <motion.div key={product.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02, duration: 0.3 }}>
                  <ProductCard product={product} onQuickView={setQuickViewProduct} />
                </motion.div>
              ))}
            </motion.div>

            {meta && meta.lastPage > 1 && (
              <nav className="mt-14 flex items-center justify-center gap-2" aria-label={t.catalog.pagination}>
                {meta.currentPage > 1 && (
                  <Link
                    href={catalogHref(query, track, { page: meta.currentPage - 1 })}
                    className="w-10 h-10 border border-[#2D1F1F]/15 rounded-md flex items-center justify-center text-[#2D1F1F]/60 hover:border-[#C9A84C]"
                    aria-label={t.catalog.previousPage}
                  >
                    <ChevronLeft size={16} className={isRTL ? 'rotate-180' : ''} />
                  </Link>
                )}
                <span className="px-4 text-sm text-[#2D1F1F]/55">
                  {meta.currentPage} / {meta.lastPage}
                </span>
                {meta.currentPage < meta.lastPage && (
                  <Link
                    href={catalogHref(query, track, { page: meta.currentPage + 1 })}
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

      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            key="catalog-filter-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              onClick={() => setIsFilterOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              dir={isRTL ? 'rtl' : 'ltr'}
              className="relative z-10 w-full max-w-[560px] max-h-[min(86vh,100%)] bg-white flex flex-col shadow-modal rounded-2xl overflow-hidden"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between px-7 sm:px-8 pt-5 pb-4 border-b border-[#2D1F1F]/8 flex-shrink-0">
                <h2 className="text-sm font-black tracking-[0.2em] uppercase text-[#2D1F1F]">
                  {t.filters.filters}{activeCount > 0 && <span className="ms-2 text-[#C9A84C]">({activeCount})</span>}
                </h2>
                <button type="button" onClick={() => setIsFilterOpen(false)} className="w-8 h-8 flex items-center justify-center text-[#2D1F1F]/50 hover:text-[#2D1F1F] transition-colors" aria-label={t.catalog.closeFilters}>
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto px-7 sm:px-8 py-6 flex-1">{filterPanelContent}</div>
              <div className="flex gap-3 px-7 sm:px-8 py-4 border-t border-[#2D1F1F]/8 flex-shrink-0 bg-white">
                <Link href={clearFiltersHref} className="h-12 px-5 border border-[#2D1F1F]/20 rounded-md text-[11px] font-bold tracking-[0.15em] uppercase text-[#2D1F1F]/70 hover:border-[#2D1F1F]/50 transition-colors flex items-center">
                  {t.filters.clearAll}
                </Link>
                <button type="button" onClick={() => setIsFilterOpen(false)} className="flex-1 h-12 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors">
                  {t.catalog.showResults.replace('{count}', String(meta?.total ?? 0))}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
}
