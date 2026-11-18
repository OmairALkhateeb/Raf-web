'use client';

import Link from 'next/link';
import { Heart, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import ProductCard from '@/components/products/ProductCard';
import { useWishlist } from '@/contexts/WishlistContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ProductCardSkeleton } from '@/components/common/Skeleton';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

export default function WishlistPage() {
  const { items, status, refresh } = useWishlist();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const { t, isRTL } = useLanguage();

  const loading = isAuthLoading || status === 'loading';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.wishlist.yourCollection}
          </span>
          <div className="flex items-end justify-between gap-4">
            <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
              {t.nav.wishlist}
            </h1>
            {isAuthenticated && status === 'ready' ? (
              <p className="text-[#2D1F1F]/40 text-sm pb-1">
                {items.length} {t.wishlist.itemsSaved}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`${cx} py-10 sm:py-14`} role="status" aria-busy="true">
          <span className="sr-only">{t.common.loading}</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-10">
            {Array.from({ length: 5 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : !isAuthenticated ? (
        <div className={`${cx} py-32 text-center`}>
          <Heart
            size={48}
            strokeWidth={1}
            className="text-[#2D1F1F]/15 mx-auto mb-8"
          />
          <h2 className="text-2xl font-serif text-[#2D1F1F] mb-3">
            {t.wishlist.signInToUse}
          </h2>
          <p className="text-[#2D1F1F]/45 text-sm mb-10 max-w-xs mx-auto leading-relaxed">
            {t.wishlist.signInHint}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-3 bg-[#2D1F1F] text-white px-10 py-3.5 text-[11px] font-black tracking-[0.25em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors duration-300"
          >
            {t.common.signIn}
            <ArrowRight size={14} className={isRTL ? 'rtl-flip' : ''} />
          </Link>
        </div>
      ) : status === 'unavailable' ? (
        <div className={`${cx} py-32 text-center`}>
          <p className="text-[#2D1F1F]/40 text-sm mb-4">{t.common.error}</p>
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
          >
            {t.common.retry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className={`${cx} py-32 text-center`}>
          <Heart
            size={48}
            strokeWidth={1}
            className="text-[#2D1F1F]/15 mx-auto mb-8"
          />
          <h2 className="text-2xl font-serif text-[#2D1F1F] mb-3">
            {t.wishlist.empty}
          </h2>
          <p className="text-[#2D1F1F]/45 text-sm mb-10 max-w-xs mx-auto leading-relaxed">
            {t.wishlist.emptyHint}
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-3 bg-[#2D1F1F] text-white px-10 py-3.5 text-[11px] font-black tracking-[0.25em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors duration-300"
          >
            {t.wishlist.exploreProducts}
            <ArrowRight size={14} className={isRTL ? 'rtl-flip' : ''} />
          </Link>
        </div>
      ) : (
        <div className={`${cx} py-10 sm:py-14`}>
          <motion.div
            layout
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-10"
          >
            {items.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}
