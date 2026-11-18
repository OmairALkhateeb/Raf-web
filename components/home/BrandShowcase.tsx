'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Brand } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface BrandShowcaseProps {
  brands: Brand[];
}

type ShowcaseArtwork =
  { kind: 'banner'; src: string } | { kind: 'logo'; src: string };

/**
 * Skip empty URLs and leftover picsum placeholders. Real backend media
 * (`cover_image_url` → `banner`, `logo_url` → `logo`) is used as-is.
 */
function isUsableArtwork(url?: string): url is string {
  return Boolean(url && url.trim() !== '' && !url.includes('picsum.photos'));
}

/** Prefer photographic cover artwork, then a logo, then the typographic fallback. */
function getShowcaseArtwork(brand: Brand): ShowcaseArtwork | null {
  if (isUsableArtwork(brand.banner)) {
    return { kind: 'banner', src: brand.banner };
  }
  if (isUsableArtwork(brand.logo)) {
    return { kind: 'logo', src: brand.logo };
  }
  return null;
}

/**
 * Brand directory grid.
 *
 * Layout:
 *  - mobile (< sm) : grid-cols-3   — exactly three cards per row, as required
 *  - sm           : grid-cols-4
 *  - lg+          : grid-cols-5    — multiple rows of clean white cards
 *
 * Each card is a square white tile with a subtle border that softly lifts and
 * gains a gold accent on hover. The card itself is the link target so the
 * whole tile is clickable on touch devices.
 */
export default function BrandShowcase({ brands }: BrandShowcaseProps) {
  const { t, isRTL } = useLanguage();

  return (
    <section
      dir={isRTL ? 'rtl' : 'ltr'}
      className="bg-[#FAF7F2] py-16 sm:py-20"
      aria-label={t.home.ourBrands}
    >
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Section header — eyebrow + decorated title + subtitle. */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center mb-10 sm:mb-14"
        >
          <span className="text-[10px] font-black tracking-[0.45em] uppercase mb-3 text-[#C9A84C]">
            {t.brand.stores}
          </span>
          <div className="flex items-center gap-4 sm:gap-5 w-full max-w-xl">
            <div className="flex-1 h-px bg-[#C9A84C]/30" />
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-[#2D1F1F] whitespace-nowrap">
              {t.home.ourBrands}
            </h2>
            <div className="flex-1 h-px bg-[#C9A84C]/30" />
          </div>
          <p className="text-[#2D1F1F]/55 text-sm sm:text-[15px] mt-4 max-w-lg leading-relaxed">
            {t.home.ourBrandsDesc}
          </p>
        </motion.div>

        {/* The grid itself.
            mobile: 3 / tablet: 4 / desktop: 5 columns => multiple rows. */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
          {brands.map((brand, i) => (
            <BrandCard key={brand.id} brand={brand} index={i} />
          ))}
        </div>

        {/* All brands CTA — matches the rest of the site's button language. */}
        <div className="flex justify-center mt-12 sm:mt-14">
          <Link
            href="/brands"
            className="group inline-flex items-center gap-3 border border-[#2D1F1F]/20 text-[#2D1F1F] px-8 py-3.5 text-[11px] font-black tracking-[0.3em] uppercase rounded-md hover:bg-[#2D1F1F] hover:text-white hover:border-[#2D1F1F] transition-all duration-300"
          >
            {t.brand.backToBrands}
            <ArrowRight
              size={14}
              className={`transition-transform duration-300 group-hover:translate-x-1 ${
                isRTL ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */

function BrandCard({ brand, index }: { brand: Brand; index: number }) {
  const { language, t } = useLanguage();
  const ar = language === 'ar';
  const name = (ar ? brand.nameAr : brand.name) ?? brand.name;
  const artwork = getShowcaseArtwork(brand);
  const isCover = artwork?.kind === 'banner';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Link
        href={`/brands/${brand.slug}`}
        className="group block focus:outline-none"
        aria-label={`${t.brand.visitStore}: ${name}`}
      >
        {/* Card tile — consistent square, soft border, gold accent on hover. */}
        <div
          className={`
            relative aspect-square
            flex items-center justify-center
            bg-white rounded-xl
            border border-[#2D1F1F]/8
            shadow-[0_1px_3px_rgba(45,31,31,0.04)]
            transition-all duration-300
            group-hover:-translate-y-0.5
            group-hover:border-[#C9A84C]/45
            group-hover:shadow-[0_10px_28px_rgba(45,31,31,0.10)]
            group-focus-visible:border-[#C9A84C]
            overflow-hidden
            ${isCover ? '' : 'p-3 sm:p-4 lg:p-5'}
          `}
        >
          {!artwork ? (
            // Typography fallback when neither cover nor logo artwork is usable.
            <div className="flex items-center justify-center w-full h-full">
              <span
                className="font-serif font-semibold text-center leading-[1.1] text-[#2D1F1F] group-hover:text-[#C9A84C] transition-colors duration-300 break-words"
                style={{
                  fontSize: 'clamp(0.95rem, 2.4vw, 1.45rem)',
                  letterSpacing: ar ? '0' : '0.01em',
                }}
              >
                {name}
              </span>
            </div>
          ) : (
            // Cover artwork fills the square (`object-cover`). Logos sit inside
            // the padded tile without cropping (`object-contain`).
            <div className="relative w-full h-full">
              <Image
                src={artwork.src}
                alt={name}
                fill
                sizes="(max-width: 640px) 30vw, (max-width: 1024px) 22vw, 18vw"
                className={`${isCover ? 'object-cover' : 'object-contain'} transition-transform duration-500 group-hover:scale-[1.04]`}
              />
            </div>
          )}

          {/* Subtle gold underline that grows on hover — premium feel without noise. */}
          <span
            aria-hidden
            className="
              absolute bottom-3 left-1/2 -translate-x-1/2
              h-px w-6 bg-[#C9A84C]/0
              group-hover:w-10 group-hover:bg-[#C9A84C]/70
              transition-all duration-300
            "
          />
        </div>

        {/* Brand name caption below the card — always visible. */}
        <p
          className="
            mt-3 text-center text-[10.5px] sm:text-[11px]
            font-bold tracking-[0.18em] uppercase
            text-[#2D1F1F]/65 group-hover:text-[#C9A84C]
            transition-colors duration-300
          "
        >
          {name}
        </p>
      </Link>
    </motion.div>
  );
}
