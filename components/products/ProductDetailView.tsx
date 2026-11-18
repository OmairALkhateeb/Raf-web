'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Breadcrumb from '@/components/common/Breadcrumb';
import Rating from '@/components/common/Rating';
import AskProductQuestionModal from '@/components/products/AskProductQuestionModal';
import BulkOrderRequestModal from '@/components/account/BulkOrderRequestModal';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import ProductReviews from '@/components/products/ProductReviews';
import ProductQuestions from '@/components/products/ProductQuestions';
import ProductViewBeacon from '@/components/products/ProductViewBeacon';
import type {
  ProductDetail,
  ProductDetailVariant,
  ProductGalleryImage,
} from '@/types';
import { parsePositiveIntString } from '@/lib/cart/ids';
import { cartErrorMessage } from '@/lib/cart/messages';
import { localizeWishlistError } from '@/lib/wishlist/messages';
import { formatMoney } from '@/utils/formatPrice';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

export default function ProductDetailView({
  product,
}: {
  product: ProductDetail;
}) {
  const hasVariants = product.hasVariants;
  const singleVariantId =
    product.variants.length === 1 ? product.variants[0].id : null;

  const [activeImg, setActiveImg] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    singleVariantId,
  );

  const { addToCart, isReady, isMutating } = useCart();
  const { toggleWishlist, isInWishlist, isPending } = useWishlist();
  const { showToast, addToRecentlyViewed } = useApp();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const { language, t, isRTL } = useLanguage();
  const router = useRouter();
  const [askOpen, setAskOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const selectedVariant: ProductDetailVariant | null = useMemo(
    () =>
      product.variants.find((variant) => variant.id === selectedVariantId) ??
      null,
    [product.variants, selectedVariantId],
  );

  const gallery: ProductGalleryImage[] =
    selectedVariant && selectedVariant.images.length > 0
      ? selectedVariant.images
      : product.images;
  const frameIndex =
    gallery.length === 0 ? 0 : Math.min(activeImg, gallery.length - 1);

  useEffect(() => {
    addToRecentlyViewed(product.listing);
  }, [product.listing, addToRecentlyViewed]);

  const name = pickLocalized(language, product.name, product.nameAr);
  const brand = pickLocalized(language, product.brand, product.brandAr);
  // The merchant's Arabic specifications replace the English list in Arabic.
  const specifications =
    language === 'ar' && product.specificationsAr.length > 0
      ? product.specificationsAr
      : product.specifications;
  const shortDescription = product.shortDescription
    ? pickLocalized(language, product.shortDescription, product.shortDescriptionAr)
    : null;
  const fullDescription = product.description
    ? pickLocalized(language, product.description, product.descriptionAr)
    : null;
  const inWishlist = isInWishlist(product.listing.id);
  const wishlistPending = isPending(product.listing.id);

  const displayPrice = selectedVariant?.price ?? product.price;
  const displayOriginal = selectedVariant
    ? selectedVariant.originalPrice
    : product.originalPrice;
  const showDiscountBadge =
    !hasVariants && product.discount !== undefined && product.discount > 0;

  const breadcrumbs = [
    { label: t.nav.home, href: '/' },
    { label: t.nav.products, href: '/products' },
    ...(product.categoryParent
      ? [{
          label: pickLocalized(language, product.categoryParent.name, product.categoryParent.nameAr),
          href: `/products?category=${encodeURIComponent(product.categoryParent.slug)}`,
        }]
      : []),
    {
      label: pickLocalized(language, product.category, product.categoryAr),
      href: `/products?category=${product.categorySlug}`,
    },
    { label: name },
  ];

  const handleAddToCart = async () => {
    if (!isReady || isMutating) return;
    const productId = parsePositiveIntString(product.listing.id);
    if (productId === null) {
      showToast(t.cart.itemNotFound, 'error');
      return;
    }

    if (hasVariants) {
      if (!selectedVariant?.isAvailable) return;
      const qty = selectedVariant.quantityAvailable
        ? Math.min(quantity, selectedVariant.quantityAvailable)
        : quantity;
      const result = await addToCart({
        productId,
        variantId: selectedVariant.id,
        quantity: qty,
        slug: product.slug,
      });
      if (result.ok) showToast(t.common.addedToCart);
      else showToast(cartErrorMessage(result, t), 'error');
      return;
    }

    if (!product.inStock) return;
    const result = await addToCart({ productId, quantity: 1, slug: product.slug });
    if (result.ok) showToast(t.common.addedToCart);
    else showToast(cartErrorMessage(result, t), 'error');
  };

  const maxVariantQty = selectedVariant?.quantityAvailable;
  const noUsableVariants = hasVariants && product.variants.length === 0;
  const needsSelection =
    hasVariants && !noUsableVariants && selectedVariant === null;

  let ctaLabel: string = t.product.addToCart;
  if (noUsableVariants) ctaLabel = t.product.variantUnavailable;
  else if (needsSelection) ctaLabel = t.product.selectOptions;

  const simpleDisabled = !hasVariants && !product.inStock;
  const variantDisabled =
    hasVariants &&
    (noUsableVariants || needsSelection || !selectedVariant?.isAvailable);
  const ctaDisabled =
    !isReady || isMutating || simpleDisabled || variantDisabled;

  const liveProductId = parsePositiveIntString(product.listing.id);

  const handleAskQuestion = () => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      showToast(t.product.askQuestionSignIn, 'info');
      router.push('/login');
      return;
    }
    if (liveProductId === null) {
      showToast(t.product.questionProductUnavailable, 'error');
      return;
    }
    setAskOpen(true);
  };

  const handleBulkOrder = () => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      showToast(t.product.bulkOrderSignIn, 'info');
      router.push('/login');
      return;
    }
    if (liveProductId === null) {
      showToast(t.product.bulkProductUnavailable, 'error');
      return;
    }
    setBulkOpen(true);
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} h-12 flex items-center`}>
          <Breadcrumb crumbs={breadcrumbs} />
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        <div className="grid lg:grid-cols-[1fr_1fr] gap-10 lg:gap-16 xl:gap-24">
          <div className="space-y-3">
            <div
              className="relative overflow-hidden bg-[#F5F3EF] group rounded-xl"
              style={{ aspectRatio: '4/5' }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${selectedVariantId ?? 'base'}-${gallery[frameIndex]?.url ?? frameIndex}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0"
                >
                  <Image
                    src={gallery[frameIndex]?.url ?? product.images[0].url}
                    alt={gallery[frameIndex]?.alt || name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    priority
                  />
                </motion.div>
              </AnimatePresence>

              {showDiscountBadge && (
                <div
                  className={`absolute top-4 z-10 ${isRTL ? 'right-4' : 'left-4'}`}
                >
                  <span className="px-3 py-1 bg-[#C9A84C] text-white text-[10px] font-black tracking-widest uppercase rounded-md">
                    −{product.discount}%
                  </span>
                </div>
              )}

              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveImg(
                        (i) => (i - 1 + gallery.length) % gallery.length,
                      )
                    }
                    aria-label={t.product.previousImage}
                    className={`absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white ${
                      isRTL ? 'right-3' : 'left-3'
                    }`}
                  >
                    <ChevronLeft
                      size={16}
                      className={isRTL ? 'rtl-flip' : ''}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveImg((i) => (i + 1) % gallery.length)
                    }
                    aria-label={t.product.nextImage}
                    className={`absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white ${
                      isRTL ? 'left-3' : 'right-3'
                    }`}
                  >
                    <ChevronRight
                      size={16}
                      className={isRTL ? 'rtl-flip' : ''}
                    />
                  </button>
                </>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="flex gap-2">
                {gallery.map((img, i) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    aria-label={`${t.product.selectImage} ${i + 1}`}
                    className={`relative w-20 h-20 overflow-hidden border-2 rounded-md transition-all ${
                      frameIndex === i
                        ? 'border-[#C9A84C]'
                        : 'border-transparent hover:border-[#2D1F1F]/25'
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt || ''}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Link
              href={`/products?brand=${product.brandSlug}`}
              className="hit-area-sm inline-block text-[11px] font-black tracking-[0.3em] uppercase text-[#C9A84C] mb-3 hover:text-[#2D1F1F] transition-colors"
            >
              {brand}
            </Link>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-[#2D1F1F] leading-tight mb-4">
              {name}
            </h1>

            <div className="flex items-center gap-5 mb-5">
              <Rating
                value={product.rating}
                count={product.reviewCount}
                size={14}
              />
              {!hasVariants && (
                <span
                  className={`text-[10px] font-black tracking-[0.15em] uppercase px-3 py-1 rounded-md ${
                    product.inStock
                      ? 'text-[#C9A84C] bg-[#C9A84C]/10'
                      : 'text-red-500 bg-red-50'
                  }`}
                >
                  {product.inStock
                    ? product.lowStock
                      ? t.product.lowStock
                      : `✓ ${t.product.inStock}`
                    : t.product.outOfStock}
                </span>
              )}
              {needsSelection && (
                <span className="text-[10px] font-black tracking-[0.15em] uppercase px-3 py-1 rounded-md text-[#2D1F1F]/50 bg-[#2D1F1F]/5">
                  {t.product.selectOptions}
                </span>
              )}
              {selectedVariant && (
                <span
                  className={`text-[10px] font-black tracking-[0.15em] uppercase px-3 py-1 rounded-md ${
                    selectedVariant.isAvailable
                      ? 'text-[#C9A84C] bg-[#C9A84C]/10'
                      : 'text-red-500 bg-red-50'
                  }`}
                >
                  {selectedVariant.isAvailable
                    ? selectedVariant.isLowStock
                      ? t.product.lowStock
                      : `✓ ${t.product.inStock}`
                    : t.product.outOfStock}
                </span>
              )}
              {noUsableVariants && (
                <span className="text-[10px] font-black tracking-[0.15em] uppercase px-3 py-1 rounded-md text-red-500 bg-red-50">
                  {t.product.variantUnavailable}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-4 mb-6">
              <span className="text-3xl font-bold text-[#2D1F1F]">
                {formatMoney(
                  displayPrice,
                  language,
                  product.listing.currency,
                  t.common.omr,
                )}
              </span>
              {displayOriginal !== undefined && (
                <>
                  <span className="text-lg text-[#2D1F1F]/30 line-through">
                    {formatMoney(
                      displayOriginal,
                      language,
                      product.listing.currency,
                      t.common.omr,
                    )}
                  </span>
                  {showDiscountBadge && (
                    <span className="px-2.5 py-0.5 bg-[#C9A84C]/12 text-[#C9A84C] text-xs font-bold rounded-md">
                      −{product.discount}%
                    </span>
                  )}
                </>
              )}
            </div>

            {shortDescription && (
              <p className="text-sm text-[#2D1F1F]/55 leading-relaxed mb-7">
                {shortDescription}
              </p>
            )}

            {product.merchantName && (
              <p className="text-xs text-[#2D1F1F]/45 mb-6 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span>{t.product.soldBy}</span>
                {product.merchantSlug ? (
                  <Link
                    href={`/sellers/${encodeURIComponent(product.merchantSlug)}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#2D1F1F]/80 hover:text-[#C9A84C] transition-colors"
                  >
                    {product.merchantLogo ? (
                      <Image
                        src={product.merchantLogo}
                        alt=""
                        width={20}
                        height={20}
                        className="w-5 h-5 rounded-full object-cover ring-1 ring-black/10 bg-white"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="w-5 h-5 rounded-full bg-[#2D1F1F]/8 text-[#2D1F1F]/70 text-[10px] font-bold flex items-center justify-center"
                      >
                        {Array.from(product.merchantName.trim())[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="underline-offset-4 hover:underline">{product.merchantName}</span>
                    <ChevronRight size={12} aria-hidden className={isRTL ? 'rotate-180' : ''} />
                  </Link>
                ) : (
                  <span>{product.merchantName}</span>
                )}
              </p>
            )}

            {hasVariants && product.variants.length > 0 && (
              <div className="mb-6">
                <span className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/50 block mb-3">
                  {t.product.selectVariant}
                </span>
                <div className="flex flex-col gap-2">
                  {product.variants.map((variant) => {
                    const selected = variant.id === selectedVariantId;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariantId(variant.id);
                          setActiveImg(0);
                          setQuantity(1);
                        }}
                        className={`w-full text-start px-4 py-3 border rounded-md transition-all ${
                          selected
                            ? 'border-[#C9A84C] bg-[#C9A84C]/8 text-[#2D1F1F]'
                            : 'border-[#2D1F1F]/15 text-[#2D1F1F]/80 hover:border-[#C9A84C]'
                        }`}
                      >
                        <span className="block text-sm font-medium">
                          {pickLocalized(language, variant.label, variant.labelAr)}
                        </span>
                        <span className="block text-xs text-[#2D1F1F]/45 mt-1">
                          {formatMoney(
                            variant.price,
                            language,
                            product.listing.currency,
                            t.common.omr,
                          )}
                          {variant.originalPrice !== undefined && (
                            <span className="line-through ms-2">
                              {formatMoney(
                                variant.originalPrice,
                                language,
                                product.listing.currency,
                                t.common.omr,
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {noUsableVariants && (
              <p className="text-sm text-[#2D1F1F]/55 mb-6">
                {t.product.variantUnavailable}
              </p>
            )}

            {selectedVariant && (
              <div className="mb-6 space-y-1">
                {selectedVariant.sku && (
                  <p className="text-xs text-[#2D1F1F]/40">
                    {t.product.sku}: {selectedVariant.sku}
                  </p>
                )}
                {selectedVariant.barcode && (
                  <p className="text-xs text-[#2D1F1F]/40">
                    {selectedVariant.barcode}
                  </p>
                )}
                {selectedVariant.isAvailable && selectedVariant.isLowStock && (
                  <p className="text-xs font-bold text-[#C9A84C]">
                    {t.product.lowStock}
                  </p>
                )}
              </div>
            )}

            {selectedVariant?.isAvailable && maxVariantQty !== undefined && (
              <div className="mb-7">
                <span className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/50 block mb-3">
                  {t.product.quantity}
                </span>
                <div className="flex items-center gap-4">
                  {/*
                    Keep flex-row-reverse on the inner stepper so minus stays
                    physically left, quantity center, and plus right under dir=rtl.
                  */}
                  <div
                    className={`flex items-center border border-[#2D1F1F]/15 rounded-md overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label={t.product.decreaseQuantity}
                      className="w-11 h-11 flex items-center justify-center text-[#2D1F1F]/50 hover:text-[#2D1F1F] hover:bg-[#2D1F1F]/5 transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-12 text-center text-sm font-bold text-[#2D1F1F] border-x border-[#2D1F1F]/15 h-11 flex items-center justify-center">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) => Math.min(maxVariantQty, q + 1))
                      }
                      aria-label={t.product.increaseQuantity}
                      className="w-11 h-11 flex items-center justify-center text-[#2D1F1F]/50 hover:text-[#2D1F1F] hover:bg-[#2D1F1F]/5 transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <span className="text-xs text-[#2D1F1F]/35 font-medium">
                    {maxVariantQty} {t.product.available}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 mb-4">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  void handleAddToCart();
                }}
                disabled={ctaDisabled}
                className="flex-1 h-13 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.2em] uppercase flex items-center justify-center gap-2.5 rounded-md hover:bg-[#C9A84C] transition-colors duration-300 disabled:opacity-40"
                style={{ height: 52 }}
              >
                <ShoppingBag size={16} />
                {ctaLabel}
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                disabled={wishlistPending}
                onClick={() => {
                  void (async () => {
                    if (wishlistPending) return;
                    const wasIn = inWishlist;
                    const result = await toggleWishlist(product.listing);
                    if (!result.ok) {
                      showToast(
                        localizeWishlistError(result, t),
                        'error',
                      );
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
                className={`w-13 h-13 border-2 flex items-center justify-center rounded-md transition-all disabled:opacity-50 ${
                  inWishlist
                    ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                    : 'border-[#2D1F1F]/20 text-[#2D1F1F]/60 hover:border-[#C9A84C] hover:text-[#C9A84C]'
                }`}
                style={{ width: 52, height: 52 }}
                aria-label={
                  inWishlist
                    ? t.product.removeFromWishlist
                    : t.product.addToWishlist
                }
                aria-pressed={inWishlist}
              >
                <Heart
                  size={17}
                  className={inWishlist ? 'fill-[#C9A84C]' : ''}
                />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  showToast(t.product.linkCopied, 'info');
                }}
                className="border-2 border-[#2D1F1F]/20 flex items-center justify-center rounded-md text-[#2D1F1F]/60 hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all"
                style={{ width: 52, height: 52 }}
                aria-label={t.product.share}
              >
                <Share2 size={17} />
              </motion.button>
            </div>

            <div className="mb-8 flex flex-wrap gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={handleAskQuestion}
                disabled={isAuthLoading || liveProductId === null}
                className="hit-area text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:underline"
              >
                {t.product.askQuestion}
              </button>
              <button
                type="button"
                onClick={handleBulkOrder}
                disabled={isAuthLoading || liveProductId === null}
                className="hit-area text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:underline"
              >
                {t.product.requestBulkOrder}
              </button>
            </div>

            {product.attributes.length > 0 && (
              <div className="max-w-lg border border-[#2D1F1F]/8 rounded-xl overflow-hidden">
                {product.attributes.map((attr, i) => (
                  <div
                    key={attr.code || `${attr.name}-${i}`}
                    className={`flex items-stretch ${i > 0 ? 'border-t border-[#2D1F1F]/8' : ''}`}
                  >
                    <span
                      className={`w-2/5 px-5 py-3.5 text-[11px] font-black tracking-[0.1em] uppercase text-[#2D1F1F]/40 bg-[#FAF7F2] ${
                        isRTL ? 'border-l' : 'border-r'
                      } border-[#2D1F1F]/8`}
                    >
                      {pickLocalized(language, attr.name, attr.nameAr)}
                    </span>
                    <span className="flex-1 px-5 py-3.5 text-sm text-[#2D1F1F]">
                      {pickLocalized(language, attr.value, attr.valueAr)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {fullDescription || specifications.length > 0 ? (
          <div className="mt-14 grid lg:grid-cols-2 gap-10 lg:gap-16">
            {fullDescription ? (
              <section aria-labelledby="product-description-title">
                <h2
                  id="product-description-title"
                  className="text-[11px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-4"
                >
                  {t.product.descriptionTitle}
                </h2>
                {/* Merchant text is plain text: keep its line breaks, never render HTML. */}
                <p className="text-sm text-[#2D1F1F]/75 leading-relaxed whitespace-pre-line">
                  {fullDescription}
                </p>
              </section>
            ) : null}
            {specifications.length > 0 ? (
              <section aria-labelledby="product-specifications-title">
                <h2
                  id="product-specifications-title"
                  className="text-[11px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-4"
                >
                  {t.product.specifications}
                </h2>
                <dl className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden">
                  {specifications.map((spec, i) => (
                    <div
                      key={`${spec.key}-${i}`}
                      className={`flex items-stretch ${i > 0 ? 'border-t border-[#2D1F1F]/8' : ''}`}
                    >
                      <dt className="w-2/5 px-5 py-3.5 text-[11px] font-black tracking-[0.1em] uppercase text-[#2D1F1F]/40 bg-[#FAF7F2] border-e border-[#2D1F1F]/8">
                        {spec.key}
                      </dt>
                      <dd className="flex-1 px-5 py-3.5 text-sm text-[#2D1F1F]">
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>
        ) : null}

        <ProductReviews
          slug={product.slug}
          initialReviews={product.reviews}
          reviewCount={product.reviewCount}
          rating={product.rating}
        />
        <ProductQuestions slug={product.slug} />
        <ProductViewBeacon slug={product.slug} />
      </div>

      {liveProductId !== null ? (
        <AskProductQuestionModal
          open={askOpen}
          productId={liveProductId}
          productName={name}
          onClose={() => setAskOpen(false)}
          onUnauthenticated={() => {
            setAskOpen(false);
            showToast(t.product.askQuestionSignIn, 'info');
            router.push('/login');
          }}
        />
      ) : null}

      {liveProductId !== null ? (
        <BulkOrderRequestModal
          open={bulkOpen}
          productId={liveProductId}
          productName={name}
          variants={product.variants}
          onClose={() => setBulkOpen(false)}
          onUnauthenticated={() => {
            setBulkOpen(false);
            showToast(t.product.bulkOrderSignIn, 'info');
            router.push('/login');
          }}
        />
      ) : null}
    </div>
  );
}
