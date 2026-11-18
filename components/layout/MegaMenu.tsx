'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Brand, Category } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface MegaMenuProps {
  categories: Category[];
  brands: Brand[];
  /** The header search is open and needs the room: hide the whole row. */
  collapsed?: boolean;
}

interface Shortcut {
  key: string;
  label: string;
  href: string;
}

function catalogShortcuts(
  categorySlug: string,
  labels: { newest: string; bestsellers: string; priceAsc: string },
): Shortcut[] {
  const base = `/products?category=${encodeURIComponent(categorySlug)}`;
  return [
    { key: 'new', label: labels.newest, href: `${base}&sort=newest` },
    { key: 'best', label: labels.bestsellers, href: `${base}&sort=bestselling` },
    { key: 'price', label: labels.priceAsc, href: `${base}&sort=price_asc` },
  ];
}

const linkClass =
  'text-[11px] font-semibold tracking-[0.15em] uppercase md:text-[14px] transition-colors whitespace-nowrap relative group text-[#2D1F1F]/70 hover:text-[#C9A84C]';

export default function MegaMenu({ categories, brands, collapsed = false }: MegaMenuProps) {
  const { language, t, isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(categories[0]?.id ?? '');
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const Chevron = isRTL ? ChevronLeft : ChevronDown;
  const brandTiles = brands.slice(0, 6);
  const hasCategories = categories.length > 0;

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, [cancelClose]);

  const openOn = (id: string) => {
    if (!id) return;
    cancelClose();
    setActiveId(id);
    setOpen(true);
  };

  const active: Category | undefined = categories.find(c => c.id === activeId) ?? categories[0];
  const name = (c: { name: string; nameAr?: string }) =>
    (language === 'ar' ? c.nameAr : c.name) ?? c.name;

  const inlineCats = categories.slice(0, 4);
  const children = active?.subCategories ?? [];

  if (collapsed) return null;

  return (
    <div
      className="hidden lg:flex items-center gap-7 flex-1 justify-center"
      onMouseLeave={scheduleClose}
      onMouseEnter={cancelClose}
    >
      {hasCategories && (
        <button
          type="button"
          onMouseEnter={() => openOn(categories[0]?.id ?? '')}
          className={`flex items-center gap-1.5 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors ${
            open ? 'text-[#C9A84C]' : 'text-[#2D1F1F]/80 hover:text-[#C9A84C]'
          }`}
        >
          {t.nav.allCategories}
          <Chevron size={13} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      <Link
        href="/products"
        onMouseEnter={scheduleClose}
        onClick={() => setOpen(false)}
        className={linkClass}
      >
        {t.nav.products}
        <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-[#C9A84C] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
      </Link>

      {/* Only where they fit (two from xl, four from 2xl); "All categories" covers the rest. */}
      {inlineCats.map((cat, index) => (
        <Link
          key={cat.id}
          href={`/products?category=${encodeURIComponent(cat.slug)}`}
          onMouseEnter={() => openOn(cat.id)}
          onClick={() => setOpen(false)}
          className={`${index < 2 ? 'hidden xl:block' : 'hidden 2xl:block'} text-[11px] font-semibold tracking-[0.15em] uppercase transition-colors whitespace-nowrap relative group ${
            open && activeId === cat.id ? 'text-[#C9A84C]' : 'text-[#2D1F1F]/70 hover:text-[#C9A84C]'
          }`}
        >
          {name(cat)}
          <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-[#C9A84C] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
        </Link>
      ))}

      <Link
        href="/brands"
        onMouseEnter={scheduleClose}
        onClick={() => setOpen(false)}
        className={linkClass}
      >
        {t.nav.brands}
        <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-[#C9A84C] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
      </Link>

      <AnimatePresence>
        {open && active && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            className="absolute left-0 right-0 top-full bg-white border-t border-[#2D1F1F]/8 shadow-[0_24px_48px_rgba(0,0,0,0.12)] z-50"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
              <div className="flex gap-8 py-8 max-h-[78vh]">

                <nav className="w-52 flex-shrink-0 border-e border-[#2D1F1F]/8 pe-6">
                  <ul className="space-y-0.5">
                    {categories.map(cat => {
                      const on = cat.id === active.id;
                      return (
                        <li key={cat.id}>
                          <Link
                            href={`/products?category=${encodeURIComponent(cat.slug)}`}
                            onMouseEnter={() => setActiveId(cat.id)}
                            onClick={() => setOpen(false)}
                            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-md transition-colors ${
                              on ? 'bg-[#FAF7F2] text-[#C9A84C]' : 'text-[#2D1F1F]/80 hover:bg-[#FAF7F2]'
                            }`}
                          >
                            <span className="text-[13px] font-semibold">{name(cat)}</span>
                            <Chevron size={13} className={on ? 'opacity-100' : 'opacity-30'} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <div className="flex-1 min-w-0 overflow-y-auto">
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-7">
                    <div>
                      <Link
                        href={`/products?category=${encodeURIComponent(active.slug)}`}
                        onClick={() => setOpen(false)}
                        className="text-[12px] font-black tracking-wide text-[#2D1F1F] hover:text-[#C9A84C] flex items-center gap-1.5 mb-3"
                      >
                        {t.catalog.allCategory.replace('{name}', name(active))}
                        <Chevron size={12} />
                      </Link>
                      {children.length === 0 && (
                        <ul className="space-y-2">
                          {catalogShortcuts(active.slug, {
                            newest: t.home.newArrivals,
                            bestsellers: t.home.bestsellers,
                            priceAsc: t.filters.sortOptions.priceAsc,
                          }).map(leaf => (
                            <li key={leaf.key}>
                              <Link
                                href={leaf.href}
                                onClick={() => setOpen(false)}
                                className="text-[12.5px] text-[#2D1F1F]/55 hover:text-[#C9A84C] transition-colors"
                              >
                                {leaf.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {children.map(sub => (
                      <div key={sub.id}>
                        <Link
                          href={`/products?category=${encodeURIComponent(sub.slug)}`}
                          onClick={() => setOpen(false)}
                          className="text-[12px] font-black tracking-wide text-[#2D1F1F] hover:text-[#C9A84C] flex items-center gap-1.5 mb-3"
                        >
                          {name(sub)}
                          <Chevron size={12} />
                        </Link>
                        <ul className="space-y-2">
                          {catalogShortcuts(sub.slug, {
                            newest: t.home.newArrivals,
                            bestsellers: t.home.bestsellers,
                            priceAsc: t.filters.sortOptions.priceAsc,
                          }).map(leaf => (
                            <li key={leaf.key}>
                              <Link
                                href={leaf.href}
                                onClick={() => setOpen(false)}
                                className="text-[12.5px] text-[#2D1F1F]/55 hover:text-[#C9A84C] transition-colors"
                              >
                                {leaf.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-72 flex-shrink-0 border-s border-[#2D1F1F]/8 ps-6">
                  <Link
                    href="/brands"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between mb-3 text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/40 hover:text-[#C9A84C] transition-colors"
                  >
                    {t.nav.brands}
                    <span className="text-[#C9A84C]">{t.home.viewAll}</span>
                  </Link>
                  {brandTiles.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      {brandTiles.map(brand => (
                        <Link
                          key={brand.id}
                          href={`/products?brand=${encodeURIComponent(brand.slug)}`}
                          onClick={() => setOpen(false)}
                          className="h-14 border border-[#2D1F1F]/10 rounded-md hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors flex items-center justify-center bg-white px-2 text-center"
                          title={name(brand)}
                        >
                          <span className="text-[12px] font-bold tracking-wide text-[#2D1F1F]/70">{name(brand)}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  <Link
                    href={`/products?category=${encodeURIComponent(active.slug)}`}
                    onClick={() => setOpen(false)}
                    className="relative block overflow-hidden group rounded-lg"
                    style={{ aspectRatio: '16/10' }}
                  >
                    <Image src={active.image} alt={name(active)} fill sizes="288px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute bottom-3 inset-x-3 text-white text-sm font-serif">{name(active)}</span>
                  </Link>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
