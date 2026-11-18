'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  X,
  ShoppingBag,
  Heart,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Rating from '@/components/common/Rating';
import { parsePositiveIntString } from '@/lib/cart/ids';
import { cartErrorMessage } from '@/lib/cart/messages';
import { localizeWishlistError } from '@/lib/wishlist/messages';
import { formatMoney } from '@/utils/formatPrice';

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
}

export default function QuickViewModal({
  product,
  onClose,
}: QuickViewModalProps) {
  const [activeImg, setActiveImg] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>();
  const [selectedSize, setSelectedSize] = useState<string>();
  const [quantity, setQuantity] = useState(1);

  const router = useRouter();
  const { addToCart, isReady, isMutating } = useCart();
  const { toggleWishlist, isInWishlist, isPending } = useWishlist();
  const { showToast } = useApp();
  const { language, t, isRTL } = useLanguage();

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setActiveImg(0);
      setSelectedColor(undefined);
      setSelectedSize(undefined);
      setQuantity(1);
    });
    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!product) return null;

  const name =
    (language === 'ar' ? product.nameAr : product.name) ?? product.name;
  const brand =
    (language === 'ar' ? product.brandAr : product.brand) ?? product.brand;
  const description =
    (language === 'ar' ? product.descriptionAr : product.description) ??
    product.description;
  const inWishlist = isInWishlist(product.id);
  const wishlistPending = isPending(product.id);
  const maxQuantity = product.stockCount;
  const hasVariants = !!product.hasVariants;
  const productHref = `/products/${product.slug ?? product.id}`;

  const handleAddToCart = async () => {
    if (hasVariants) {
      onClose();
      router.push(productHref);
      return;
    }
    if (!isReady || isMutating || !product.inStock) return;
    const productId = parsePositiveIntString(product.id);
    if (productId === null) {
      showToast(t.cart.itemNotFound, 'error');
      return;
    }
    const result = await addToCart({ productId, quantity, slug: product.slug });
    if (result.ok) {
      showToast(t.common.addedToCart);
      onClose();
    } else {
      showToast(cartErrorMessage(result, t), 'error');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/65 z-[80] flex items-center justify-center p-4 sm:p-8"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="bg-white max-w-3xl w-full max-h-[min(92vh,100%)] overflow-y-auto relative rounded-2xl"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className={`absolute top-4 z-20 w-8 h-8 bg-white border border-[#2D1F1F]/12 flex items-center justify-center rounded-md hover:border-[#2D1F1F] transition-colors ${
              isRTL ? 'left-4' : 'right-4'
            }`}
          >
            <X size={14} />
          </button>

          <div className="grid md:grid-cols-2">
            {/* Images */}
            <div className="bg-[#F5F3EF]">
              <div className="relative" style={{ aspectRatio: '1/1' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeImg}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={product.images[activeImg]}
                      alt={name}
                      fill
                      className="object-cover"
                      sizes="400px"
                    />
                  </motion.div>
                </AnimatePresence>

                {product.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label={t.product.previousImage}
                      onClick={() =>
                        setActiveImg(
                          (i) =>
                            (i - 1 + product.images.length) %
                            product.images.length,
                        )
                      }
                      className={`absolute top-1/2 -translate-y-1/2 w-9 h-9 bg-white/85 flex items-center justify-center rounded-md hover:bg-white transition-colors ${
                        isRTL ? 'right-2' : 'left-2'
                      }`}
                    >
                      <ChevronLeft
                        size={14}
                        className={isRTL ? 'rtl-flip' : ''}
                      />
                    </button>
                    <button
                      type="button"
                      aria-label={t.product.nextImage}
                      onClick={() =>
                        setActiveImg((i) => (i + 1) % product.images.length)
                      }
                      className={`absolute top-1/2 -translate-y-1/2 w-9 h-9 bg-white/85 flex items-center justify-center rounded-md hover:bg-white transition-colors ${
                        isRTL ? 'left-2' : 'right-2'
                      }`}
                    >
                      <ChevronRight
                        size={14}
                        className={isRTL ? 'rtl-flip' : ''}
                      />
                    </button>
                  </>
                )}
              </div>

              {product.images.length > 1 && (
                <div className="flex gap-2 p-3 justify-center">
                  {product.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      className={`w-12 h-12 overflow-hidden border-2 rounded-md transition-colors ${
                        activeImg === i
                          ? 'border-[#C9A84C]'
                          : 'border-transparent hover:border-[#2D1F1F]/20'
                      }`}
                    >
                      <Image
                        src={img}
                        alt=""
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-7 flex flex-col">
              <div className="flex-1">
                <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#C9A84C] mb-2">
                  {brand}
                </p>
                <h2 className="text-xl font-serif text-[#2D1F1F] leading-snug mb-3">
                  {name}
                </h2>

                <div className="flex items-center gap-3 mb-4">
                  <Rating value={product.rating} count={product.reviewCount} />
                  <span
                    className={`text-[10px] font-black tracking-[0.1em] uppercase px-2.5 py-1 rounded-md ${
                      product.inStock
                        ? 'bg-[#C9A84C]/10 text-[#C9A84C]'
                        : 'bg-red-50 text-red-500'
                    }`}
                  >
                    {product.inStock
                      ? product.lowStock
                        ? t.product.lowStock
                        : t.product.inStock
                      : t.product.outOfStock}
                  </span>
                </div>

                <div className="flex items-baseline gap-3 mb-5">
                  <span className="text-2xl font-bold text-[#2D1F1F]">
                    {formatMoney(
                      product.price,
                      language,
                      product.currency ?? 'OMR',
                      t.common.omr,
                    )}
                  </span>
                  {product.originalPrice && (
                    <span className="text-sm text-[#2D1F1F]/30 line-through">
                      {formatMoney(
                        product.originalPrice,
                        language,
                        product.currency ?? 'OMR',
                        t.common.omr,
                      )}
                    </span>
                  )}
                  {product.discount && (
                    <span className="text-[10px] font-black bg-[#C9A84C] text-white px-2 py-0.5 rounded-md">
                      −{product.discount}%
                    </span>
                  )}
                </div>

                <p className="text-sm text-[#2D1F1F]/55 leading-relaxed mb-5 line-clamp-3">
                  {description}
                </p>

                {/* Colors */}
                {product.colors && (
                  <div className="mb-4">
                    <p className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2">
                      {t.product.selectColor}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {product.colors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={`px-4 py-1.5 text-xs border transition-all font-medium rounded-md ${
                            selectedColor === color
                              ? 'border-[#C9A84C] bg-[#C9A84C]/8 text-[#C9A84C]'
                              : 'border-[#2D1F1F]/15 text-[#2D1F1F]/70 hover:border-[#2D1F1F]/40'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sizes */}
                {product.sizes && (
                  <div className="mb-4">
                    <p className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2">
                      {t.product.selectSize}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {product.sizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`w-10 h-9 text-xs border font-bold transition-all rounded-md ${
                            selectedSize === size
                              ? 'border-[#C9A84C] bg-[#C9A84C] text-white'
                              : 'border-[#2D1F1F]/15 text-[#2D1F1F]/70 hover:border-[#C9A84C]'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div className="mb-5">
                  <p className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2">
                    {t.product.quantity}
                  </p>
                  <div
                    className={`flex items-center border border-[#2D1F1F]/15 w-fit rounded-md overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <button
                      type="button"
                      aria-label={t.product.decreaseQuantity}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-9 h-9 flex items-center justify-center text-[#2D1F1F]/50 hover:text-[#2D1F1F] hover:bg-[#2D1F1F]/5 transition-colors"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-[#2D1F1F] border-x border-[#2D1F1F]/15 h-9 flex items-center justify-center">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={t.product.increaseQuantity}
                      onClick={() =>
                        setQuantity((q) =>
                          maxQuantity === undefined
                            ? q
                            : Math.min(maxQuantity, q + 1),
                        )
                      }
                      className="w-9 h-9 flex items-center justify-center text-[#2D1F1F]/50 hover:text-[#2D1F1F] hover:bg-[#2D1F1F]/5 transition-colors"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-5 border-t border-[#2D1F1F]/8">
                <button
                  onClick={() => {
                    void handleAddToCart();
                  }}
                  disabled={
                    !hasVariants && (!product.inStock || !isReady || isMutating)
                  }
                  className="flex-1 h-11 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.18em] uppercase flex items-center justify-center gap-2 rounded-md hover:bg-[#C9A84C] transition-colors disabled:opacity-40"
                >
                  <ShoppingBag size={14} />
                  {hasVariants ? t.product.selectOptions : t.product.addToCart}
                </button>
                <button
                  type="button"
                  disabled={wishlistPending}
                  onClick={() => {
                    void (async () => {
                      if (wishlistPending) return;
                      const wasIn = inWishlist;
                      const result = await toggleWishlist(product);
                      if (!result.ok) {
                        showToast(localizeWishlistError(result, t), 'error');
                        if (result.code === 'unauthenticated')
                          router.push('/login');
                        return;
                      }
                      showToast(
                        wasIn
                          ? t.common.removedFromWishlist
                          : t.common.addedToWishlist,
                      );
                    })();
                  }}
                  aria-label={
                    inWishlist
                      ? t.product.removeFromWishlist
                      : t.product.addToWishlist
                  }
                  className={`w-11 h-11 border-2 flex items-center justify-center rounded-md transition-all disabled:opacity-50 ${
                    inWishlist
                      ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                      : 'border-[#2D1F1F]/20 text-[#2D1F1F]/60 hover:border-[#C9A84C] hover:text-[#C9A84C]'
                  }`}
                >
                  <Heart
                    size={15}
                    className={inWishlist ? 'fill-[#C9A84C]' : ''}
                  />
                </button>
              </div>

              <Link
                href={`/products/${product.slug ?? product.id}`}
                onClick={onClose}
                className="inline-flex items-center justify-center gap-1.5 text-center text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/35 hover:text-[#C9A84C] mt-4 transition-colors"
              >
                {t.product.viewFullDetails}
                <ChevronRight
                  size={12}
                  className={isRTL ? 'rtl-flip' : ''}
                />
              </Link>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
