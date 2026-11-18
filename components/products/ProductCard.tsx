'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingBag, Eye, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { parsePositiveIntString } from '@/lib/cart/ids';
import { cartErrorMessage } from '@/lib/cart/messages';
import { localizeWishlistError } from '@/lib/wishlist/messages';
import { formatMoney } from '@/utils/formatPrice';

/** A link, or a plain block when the destination no longer exists. */
function MaybeLink({
  href,
  onClick,
  className,
  children,
}: {
  href: string | null;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  if (href === null) return <div className={className}>{children}</div>;
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

export default function ProductCard({
  product,
  onQuickView,
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const router = useRouter();

  const { addToCart, isInCart, isReady, isMutating } = useCart();
  const { toggleWishlist, isInWishlist, isPending } = useWishlist();
  const { showToast, addToRecentlyViewed } = useApp();
  const { language, t, isRTL } = useLanguage();

  const inWishlist = isInWishlist(product.id);
  const wishlistPending = isPending(product.id);
  const inCart = isInCart(product.id);
  const name =
    (language === 'ar' ? product.nameAr : product.name) ?? product.name;
  const brand =
    (language === 'ar' ? product.brandAr : product.brand) ?? product.brand;
  // Wishlist products have no brand slug (backend): show the name unlinked.
  const brandSlug = product.brandSlug ?? null;
  const productHref = `/products/${product.slug ?? product.id}`;
  // Wishlist rows for products no longer sold: their page 404s and they can't
  // be bought, so no links and no cart buttons; removing still works.
  const unavailable = product.unavailable === true;
  const canQuickView =
    !unavailable && !!onQuickView && typeof product.stockCount === 'number';
  const hasVariants = !!product.hasVariants;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants || !isReady || isMutating) return;
    const productId = parsePositiveIntString(product.id);
    if (productId === null) {
      showToast(t.cart.itemNotFound, 'error');
      return;
    }
    const result = await addToCart({ productId, quantity: 1, slug: product.slug });
    if (result.ok) showToast(t.common.addedToCart);
    else showToast(cartErrorMessage(result, t), 'error');
  };

  const handleSelectOptions = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToRecentlyViewed(product);
    router.push(productHref);
  };

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (wishlistPending) return;
    const wasIn = inWishlist;
    const result = await toggleWishlist(product);
    if (!result.ok) {
      showToast(localizeWishlistError(result, t), 'error');
      if (result.code === 'unauthenticated') router.push('/login');
      return;
    }
    showToast(wasIn ? t.common.removedFromWishlist : t.common.addedToWishlist);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
    addToRecentlyViewed(product);
  };

  return (
    <motion.article
      className="group relative flex flex-col"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      initial={false}
    >
      {/* Media: image Link and overlay actions are siblings — never nest buttons in an anchor. */}
      <div
        className="relative overflow-hidden bg-[#F5F3EF] rounded-xl"
        style={{ aspectRatio: '4/5' }}
      >
        <MaybeLink
          href={unavailable ? null : productHref}
          onClick={() => addToRecentlyViewed(product)}
          className="absolute inset-0 block"
        >
          {!imgLoaded && (
            <div className="absolute inset-0 bg-gradient-to-r from-[#EFECEA] via-[#E6E3DE] to-[#EFECEA] animate-shimmer" />
          )}

          <Image
            src={product.images[0]}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover transition-transform duration-700 ease-out ${
              isHovered ? 'scale-[1.08]' : 'scale-100'
            } ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
          />

          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent transition-opacity duration-400 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          />

          <div
            className={`absolute top-3 z-[1] flex flex-col gap-1.5 ${isRTL ? 'right-3' : 'left-3'}`}
          >
            {product.discount && product.discount > 0 && (
              <span className="px-2.5 py-0.5 bg-[#C9A84C] text-white text-[10px] font-bold tracking-widest uppercase rounded-md">
                −{product.discount}%
              </span>
            )}
            {product.isNew && (
              <span className="px-2.5 py-0.5 bg-[#2D1F1F] text-[#E8D5A3] text-[10px] font-bold tracking-widest uppercase rounded-md">
                {t.product.new}
              </span>
            )}
            {product.inStock && product.lowStock && (
              <span className="px-2.5 py-0.5 bg-white/90 text-[#B8860B] text-[10px] font-bold tracking-widest uppercase border border-[#C9A84C]/40 rounded-md">
                {t.product.lowStock}
              </span>
            )}
            {product.isBestseller && !product.isNew && !product.discount && (
              <span className="px-2.5 py-0.5 bg-white/90 text-[#2D1F1F] text-[10px] font-bold tracking-widest uppercase border border-[#2D1F1F]/15 rounded-md">
                {t.product.bestseller}
              </span>
            )}
          </div>
        </MaybeLink>

        {unavailable ? (
          <div className="absolute inset-0 z-[5] pointer-events-none bg-white/65 backdrop-blur-[2px] flex items-center justify-center p-3">
            <span className="px-4 py-1.5 bg-[#2D1F1F] text-white text-[11px] font-bold tracking-widest uppercase rounded-md text-center">
              {t.wishlist.noLongerAvailable}
            </span>
          </div>
        ) : !product.inStock && (
          <div className="absolute inset-0 z-[5] pointer-events-none bg-white/55 backdrop-blur-[2px] flex items-center justify-center">
            <span className="px-5 py-1.5 bg-[#2D1F1F] text-white text-xs font-bold tracking-widest uppercase rounded-md">
              {t.common.soldOut}
            </span>
          </div>
        )}

        <motion.button
          type="button"
          onClick={(e) => {
            void handleToggleWishlist(e);
          }}
          disabled={wishlistPending}
          className={`absolute top-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-300 disabled:opacity-50 ${
            isRTL ? 'left-3' : 'right-3'
          } ${
            inWishlist
              ? 'bg-[#C9A84C] text-white shadow-lg shadow-[#C9A84C]/40'
              : 'bg-white/80 backdrop-blur-sm text-[#2D1F1F] hover:bg-[#C9A84C] hover:text-white'
          }`}
          whileTap={{ scale: 0.85 }}
          aria-label={
            inWishlist ? t.product.removeFromWishlist : t.product.addToWishlist
          }
        >
          <Heart size={14} fill={inWishlist ? 'currentColor' : 'none'} />
        </motion.button>

        <AnimatePresence>
          {isHovered && !unavailable && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute inset-x-0 bottom-0 z-10 p-3 flex gap-2"
            >
              {hasVariants ? (
                <motion.button
                  type="button"
                  onClick={handleSelectOptions}
                  className="flex-1 flex items-center justify-center gap-2 h-10 text-[11px] font-bold tracking-widest uppercase rounded-md bg-[#C9A84C] text-white hover:bg-[#b8943f] transition-colors"
                  whileTap={{ scale: 0.97 }}
                >
                  <ShoppingBag size={13} />
                  {t.product.selectOptions}
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!product.inStock || !isReady || isMutating}
                  className={`flex-1 flex items-center justify-center gap-2 h-10 text-[11px] font-bold tracking-widest uppercase rounded-md transition-colors ${
                    inCart
                      ? 'bg-[#2D1F1F] text-[#C9A84C]'
                      : 'bg-[#C9A84C] text-white hover:bg-[#b8943f]'
                  } disabled:opacity-50`}
                  whileTap={{ scale: 0.97 }}
                >
                  <ShoppingBag size={13} />
                  {inCart ? t.cart.inBag : t.product.addToCart}
                </motion.button>
              )}

              {canQuickView && (
                <motion.button
                  type="button"
                  onClick={handleQuickView}
                  className="w-10 h-10 bg-white/15 backdrop-blur-sm border border-white/30 text-white flex items-center justify-center rounded-md hover:bg-white/30 transition-colors"
                  whileTap={{ scale: 0.92 }}
                  aria-label={t.product.quickView}
                  title={t.product.quickView}
                >
                  <Eye size={14} />
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        className={`pt-4 pb-2 flex flex-col gap-1 ${isRTL ? 'text-right' : 'text-left'}`}
      >
        {brand && brandSlug ? (
          <Link
            href={`/products?brand=${encodeURIComponent(brandSlug)}`}
            className="hit-area-up text-[10px] font-black tracking-[0.28em] uppercase text-[#C9A84C] truncate leading-none hover:text-[#2D1F1F] transition-colors w-fit"
          >
            {brand}
          </Link>
        ) : brand ? (
          <span className="text-[10px] font-black tracking-[0.28em] uppercase text-[#C9A84C] truncate leading-none w-fit">
            {brand}
          </span>
        ) : null}

        <MaybeLink
          href={unavailable ? null : productHref}
          onClick={() => addToRecentlyViewed(product)}
          className="hit-area-sm block"
        >
          <h3
            className={`text-sm font-medium leading-snug line-clamp-2 transition-colors duration-200 mt-0.5 ${
              unavailable
                ? 'text-[#2D1F1F]/45'
                : 'text-[#2D1F1F] hover:text-[#C9A84C]'
            }`}
          >
            {name}
          </h3>
        </MaybeLink>

        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={9}
                className={
                  i < Math.floor(product.rating)
                    ? 'text-[#C9A84C] fill-[#C9A84C]'
                    : 'text-gray-200 fill-gray-200'
                }
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-400 leading-none">
            ({product.reviewCount})
          </span>
        </div>

        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-[15px] font-bold text-[#2D1F1F] tracking-tight">
            {formatMoney(
              product.price,
              language,
              product.currency ?? 'OMR',
              t.common.omr,
            )}
          </span>
          {product.originalPrice && (
            <span className="text-xs text-gray-400 line-through font-normal">
              {formatMoney(
                product.originalPrice,
                language,
                product.currency ?? 'OMR',
                t.common.omr,
              )}
            </span>
          )}
        </div>
      </div>

      <motion.div
        className="h-[1.5px] bg-[#C9A84C] origin-left"
        animate={{ scaleX: isHovered ? 1 : 0 }}
        transition={{ duration: 0.35 }}
      />
    </motion.article>
  );
}
