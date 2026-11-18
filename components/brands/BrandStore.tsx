'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MapPin, Package, ChevronRight, ChevronLeft } from 'lucide-react';
import { Brand, Product } from '@/types';
import ProductCard from '@/components/products/ProductCard';
import BrandStatusMessage from '@/components/brands/BrandStatusMessage';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import { brandStoreHref } from '@/lib/brands/params';

export type BrandStoreStatus = 'ok' | 'empty' | 'beyond-page' | 'invalid' | 'unavailable' | 'data-error';

export interface BrandStoreMeta {
  total: number;
  currentPage: number;
  lastPage: number;
  perPage: number;
}

interface BrandStoreProps {
  status: BrandStoreStatus;
  brand: Brand | null;
  products: Product[];
  meta: BrandStoreMeta | null;
  tracking: Record<string, string>;
  firstPageHref: string;
}

function trackingParams(tracking: Record<string, string>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(tracking)) sp.set(key, value);
  return sp;
}

export default function BrandStore({
  status,
  brand,
  products,
  meta,
  tracking,
  firstPageHref,
}: BrandStoreProps) {
  const { language, t, isRTL } = useLanguage();
  const copy = t.brand;
  const track = trackingParams(tracking);

  if (status === 'unavailable') {
    return <BrandStatusMessage kind="unavailable" />;
  }

  if (status === 'data-error') {
    return <BrandStatusMessage kind="data-error" />;
  }

  if (!brand) {
    return <BrandStatusMessage kind="not-found" />;
  }

  const name = pickLocalized(language, brand.name, brand.nameAr);
  const description = pickLocalized(
    language,
    brand.description,
    brand.descriptionAr,
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <section className="relative isolate bg-[#2D1F1F] overflow-visible">
        <div className="relative z-0 h-[240px] sm:h-[320px] lg:h-[380px] overflow-hidden">
          {brand.banner && (
            <Image
              src={brand.banner}
              alt={name}
              fill
              sizes="100vw"
              priority
              className="object-cover opacity-50"
            />
          )}
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#2D1F1F] via-[#2D1F1F]/60 to-transparent pointer-events-none" />
        </div>

        <div className="absolute top-0 inset-x-0 z-20">
          <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 pt-5">
            <nav className="flex items-center gap-2 text-[11px] font-semibold text-white/70">
              <Link href="/" className="hit-area-y hover:text-[#C9A84C] transition-colors">{t.nav.home}</Link>
              <ChevronRight size={11} className={isRTL ? 'rotate-180' : ''} />
              <Link href="/brands" className="hit-area-y hover:text-[#C9A84C] transition-colors">{t.nav.brands}</Link>
              <ChevronRight size={11} className={isRTL ? 'rotate-180' : ''} />
              <span className="text-[#C9A84C]">{name}</span>
            </nav>
          </div>
        </div>

        <div className="relative z-10 max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          <div className="relative -mt-16 sm:-mt-20 pb-8 flex flex-col sm:flex-row sm:items-end gap-5">
            <div className="relative z-10 w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 bg-white shadow-[0_12px_32px_rgba(0,0,0,0.25)] ring-1 ring-black/5 overflow-hidden rounded-xl flex items-center justify-center">
              {brand.logo ? (
                <Image src={brand.logo} alt={name} width={128} height={128} className="w-full h-full object-contain" />
              ) : (
                <span className="font-serif font-semibold text-[#2D1F1F] text-center leading-tight px-2 text-lg sm:text-xl">
                  {name}
                </span>
              )}
            </div>
            <div className="flex-1 sm:pb-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-white">{name}</h1>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border-b border-[#2D1F1F]/8">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-7">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-10">
            {description ? (
              <p className="text-[#2D1F1F]/70 text-sm leading-relaxed max-w-2xl flex-1">{description}</p>
            ) : (
              <div className="flex-1" />
            )}
            <div className="flex items-center gap-6 flex-shrink-0">
              {brand.origin ? (
                <div className="flex items-center gap-2 text-[#2D1F1F]/60 text-[13px] font-semibold">
                  <MapPin size={15} className="text-[#C9A84C]" />
                  {brand.origin}
                </div>
              ) : null}
              <div className="flex items-center gap-2 text-[#2D1F1F]/60 text-[13px] font-semibold">
                <Package size={15} className="text-[#C9A84C]" />
                {brand.productCount} {copy.products}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#FAF7F2]">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-12 sm:py-16">
          {status === 'invalid' && (
            <StatusBlock
              title={copy.invalid}
              hint={copy.invalidHint}
              href={firstPageHref}
              label={copy.visitStore}
            />
          )}

          {status === 'beyond-page' && (
            <StatusBlock
              title={copy.emptyPage}
              href={firstPageHref}
              label={copy.backToFirstPage}
            />
          )}

          {status === 'empty' && (
            <StatusBlock title={copy.emptyProducts} />
          )}

          {status === 'ok' && (
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
                      href={brandStoreHref(brand.slug, meta.currentPage - 1, track)}
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
                      href={brandStoreHref(brand.slug, meta.currentPage + 1, track)}
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
      <p className="text-[#2D1F1F]/70 text-sm">{title}</p>
      {hint ? <p className="text-[#2D1F1F]/45 text-sm mt-2">{hint}</p> : null}
      {href && label ? (
        <Link
          href={href}
          className="inline-block mt-8 text-[11px] font-black tracking-[0.2em] uppercase text-[#2D1F1F] hover:text-[#C9A84C]"
        >
          {label}
        </Link>
      ) : null}
    </div>
  );
}
