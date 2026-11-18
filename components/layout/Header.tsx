'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Heart, User, Menu, Search, X, Globe, Loader2, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '@/components/common/Logo';
import MegaMenu from '@/components/layout/MegaMenu';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { unreadBadge } from '@/lib/notifications/present';
import { searchPageHref } from '@/lib/search/params';
import type { Brand, Category, Product } from '@/types';

interface HeaderProps {
  categories: Category[];
  brands: Brand[];
}

type SuggestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; products: Product[]; total: number }
  | { status: 'empty' }
  | { status: 'error' };

const DEBOUNCE_MS = 320;

export default function Header({ categories, brands }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggest, setSuggest] = useState<SuggestState>({ status: 'idle' });
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const epochRef = useRef(0);
  const router = useRouter();

  const { itemCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { language, setLanguage, t, isRTL } = useLanguage();
  const { isSearchOpen, setSearchOpen, setMobileMenuOpen } = useApp();
  const { isAuthenticated, user } = useAuth();
  const { unread } = useNotifications();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSuggest({ status: 'idle' });
    abortRef.current?.abort();
  }, [setSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSearchOpen, closeSearch]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const id = window.setTimeout(() => {
      (window.matchMedia('(min-width: 1024px)').matches
        ? inputRef
        : mobileInputRef
      ).current?.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [isSearchOpen]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!isSearchOpen || !q) {
      abortRef.current?.abort();
      return;
    }

    const epoch = ++epochRef.current;
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSuggest({ status: 'loading' });
      void (async () => {
        try {
          const res = await fetch(
            `/api/public/search?q=${encodeURIComponent(q)}&per_page=6`,
            {
              signal: controller.signal,
              headers: { Accept: 'application/json' },
            },
          );
          if (epoch !== epochRef.current) return;
          if (!res.ok) {
            setSuggest({ status: 'error' });
            return;
          }
          const json = (await res.json()) as {
            ok?: boolean;
            products?: Product[];
            meta?: { total: number };
          };
          if (epoch !== epochRef.current) return;
          if (!json.ok || !Array.isArray(json.products)) {
            setSuggest({ status: 'error' });
            return;
          }
          if (json.products.length === 0) {
            setSuggest({ status: 'empty' });
            return;
          }
          setSuggest({
            status: 'ok',
            products: json.products,
            total: json.meta?.total ?? json.products.length,
          });
        } catch (error) {
          if ((error as Error).name === 'AbortError') return;
          if (epoch !== epochRef.current) return;
          setSuggest({ status: 'error' });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery, isSearchOpen]);

  const goToSearchPage = () => {
    const query = searchQuery.trim();
    router.push(searchPageHref(query, 1));
    closeSearch();
  };

  const productLabel = (p: Product) =>
    language === 'ar' ? (p.nameAr ?? p.name) : p.name;

  const suggestPanel = (
    <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-[#2D1F1F]/10 rounded-xl shadow-lg overflow-hidden">
      {suggest.status === 'loading' ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#2D1F1F]/45">
          <Loader2 size={14} className="animate-spin text-[#C9A84C]" />
          {t.searchPage.searching}
        </div>
      ) : null}
      {suggest.status === 'empty' ? (
        <p className="px-4 py-5 text-sm text-[#2D1F1F]/45 text-center">
          {t.searchPage.noResults}
        </p>
      ) : null}
      {suggest.status === 'error' ? (
        <p className="px-4 py-5 text-sm text-[#2D1F1F]/45 text-center">
          {t.searchPage.unavailable}
        </p>
      ) : null}
      {suggest.status === 'ok' ? (
        <ul className="max-h-80 overflow-y-auto divide-y divide-[#2D1F1F]/8">
          {suggest.products.map((product) => {
            const href = `/products/${product.slug ?? product.id}`;
            const img =
              product.images[0] || '/images/placeholder-media.svg';
            return (
              <li key={product.id}>
                <Link
                  href={href}
                  onClick={closeSearch}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF7F2] transition-colors"
                >
                  <div className="relative w-12 h-12 rounded-md overflow-hidden bg-[#F5F3EF] flex-shrink-0">
                    <Image
                      src={img}
                      alt={productLabel(product)}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <span className="text-sm text-[#2D1F1F] line-clamp-2">
                    {productLabel(product)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      {searchQuery.trim() ? (
        <button
          type="button"
          onClick={goToSearchPage}
          className="w-full border-t border-[#2D1F1F]/8 px-4 py-3 text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:bg-[#FAF7F2]"
        >
          {t.searchPage.viewAll}
        </button>
      ) : null}
    </div>
  );

  return (
  
      <header
        dir={isRTL ? 'rtl' : 'ltr'}
        className={`sticky top-0 z-50 bg-white transition-all duration-300 ${
          scrolled
            ? 'shadow-[0_2px_24px_rgba(0,0,0,0.08)] border-b border-transparent'
            : 'border-b border-[#2D1F1F]/8'
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16">
          <div className="flex items-center justify-between h-[68px] gap-6">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="hit-area lg:hidden p-1.5 text-[#2D1F1F] hover:text-[#C9A84C] transition-colors"
              aria-label={t.common.openMenu}
            >
              <Menu size={22} />
            </button>

            <div className="flex-shrink-0">
              <Logo size="md" />
            </div>

            <MegaMenu
              categories={categories}
              brands={brands}
              collapsed={isSearchOpen}
            />

            {/* Tighter on phones: at 360px wide (common Android) the icons and the
                cart button otherwise push the page sideways. */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden lg:block relative" ref={searchRef}>
                <AnimatePresence mode="wait">
                  {isSearchOpen ? (
                    <motion.div
                      key="search-open"
                      initial={{ width: 40, opacity: 0 }}
                      animate={{ width: 320, opacity: 1 }}
                      exit={{ width: 40, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="relative"
                      role="search"
                    >
                      <input
                        ref={inputRef}
                        type="search"
                        placeholder={t.nav.search}
                        value={searchQuery}
                        onChange={(e) => {
                          const next = e.target.value;
                          setSearchQuery(next);
                          if (!next.trim()) setSuggest({ status: 'idle' });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            goToSearchPage();
                          }
                        }}
                        className={`raf-header-search w-full h-9 bg-[#FAF7F2] border border-[#2D1F1F]/15 text-sm rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors ${
                          isRTL ? 'pr-4 pl-9 text-right' : 'pl-4 pr-9'
                        }`}
                        aria-label={t.searchPage.title}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={closeSearch}
                        className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#C9A84C] ${isRTL ? 'left-2' : 'right-2'}`}
                        aria-label={t.common.close}
                      >
                        <X size={14} />
                      </button>
                      {searchQuery.trim() || suggest.status !== 'idle'
                        ? suggestPanel
                        : null}
                    </motion.div>
                  ) : (
                    <motion.button
                      key="search-icon"
                      type="button"
                      onClick={() => setSearchOpen(true)}
                      className="p-2 text-[#2D1F1F]/70 hover:text-[#C9A84C] transition-colors"
                      aria-label={t.searchPage.title}
                    >
                      <Search size={19} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isSearchOpen) closeSearch();
                  else setSearchOpen(true);
                }}
                className="hit-area lg:hidden p-1.5 text-[#2D1F1F]/70 hover:text-[#C9A84C] transition-colors"
                aria-label={isSearchOpen ? t.common.close : t.searchPage.title}
              >
                {isSearchOpen ? <X size={19} /> : <Search size={19} />}
              </button>

              <button
                type="button"
                onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-[#2D1F1F]/60 hover:text-[#C9A84C] transition-colors"
                aria-label={t.auth.languageSwitchLabel}
              >
                <Globe size={14} />
                {t.common.languageSwitch}
              </button>

              <Link
                href="/wishlist"
                className="hit-area relative p-1.5 text-[#2D1F1F]/70 hover:text-[#C9A84C] transition-colors"
                aria-label={t.nav.wishlist}
              >
                <Heart size={19} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#C9A84C] text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {isAuthenticated ? (
                <Link
                  href="/account/notifications"
                  className="hit-area relative p-1.5 text-[#2D1F1F]/70 hover:text-[#C9A84C] transition-colors"
                  aria-label={t.notifications.bellLabel.replace(
                    '{count}',
                    String(unread.unreadCount),
                  )}
                >
                  <Bell size={19} />
                  {unread.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 bg-[#C9A84C] text-white text-[9px] font-black rounded-full flex items-center justify-center">
                      {unreadBadge(unread.unreadCount)}
                    </span>
                  )}
                </Link>
              ) : null}

              <Link
                href={isAuthenticated ? '/account' : '/login'}
                className="hit-area hidden sm:flex p-1.5 text-[#2D1F1F]/70 hover:text-[#C9A84C] transition-colors"
                aria-label={isAuthenticated ? user?.name ?? t.nav.account : t.common.signIn}
              >
                <User size={19} />
              </Link>

              <Link
                href="/cart"
                className="flex items-center gap-2 sm:gap-2.5 bg-[#2D1F1F] text-white px-3.5 sm:px-5 py-2.5 text-[11px] font-bold tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors duration-300"
                aria-label={t.nav.cart}
              >
                <ShoppingBag size={15} />
                {itemCount > 0 ? itemCount : ''}
                <span className="hidden sm:inline">
                  {t.common.bag}
                </span>
              </Link>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden border-t border-[#2D1F1F]/8 overflow-visible bg-white"
            >
              <div className="px-4 py-3 relative" role="search">
                <input
                  ref={mobileInputRef}
                  type="search"
                  placeholder={t.nav.search}
                  value={searchQuery}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSearchQuery(next);
                    if (!next.trim()) setSuggest({ status: 'idle' });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      goToSearchPage();
                    }
                  }}
                  className={`raf-header-search w-full h-10 bg-[#FAF7F2] border border-[#2D1F1F]/15 text-sm px-4 rounded-md focus:outline-none focus:border-[#C9A84C] ${isRTL ? 'pl-10 text-right' : 'pr-10'}`}
                  aria-label={t.searchPage.title}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={goToSearchPage}
                  className={`absolute top-1/2 -translate-y-1/2 mt-0.5 p-2 text-[#C9A84C] ${isRTL ? 'left-6' : 'right-6'}`}
                  aria-label={t.searchPage.submit}
                >
                  <Search size={16} />
                </button>
                {searchQuery.trim() || suggest.status !== 'idle' ? (
                  <div className="relative z-50">{suggestPanel}</div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
 
  );
}
