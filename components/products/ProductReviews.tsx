'use client';

import { useState } from 'react';
import { BadgeCheck, Loader2, Star } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ProductDetailReview } from '@/types';

const PER_PAGE = 10;

type Props = {
  slug: string;
  /** The latest reviews sent with the product (up to 10 = page 1). */
  initialReviews: ProductDetailReview[];
  reviewCount: number;
  rating: number;
};

function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < Math.round(value) ? 'text-[#C9A84C] fill-[#C9A84C]' : 'text-[#2D1F1F]/15 fill-[#2D1F1F]/10'}
        />
      ))}
    </span>
  );
}

function formatDate(iso: string, language: 'en' | 'ar'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(language === 'ar' ? 'ar-OM' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Approved reviews with the seller's replies; more pages load on demand. */
export default function ProductReviews({ slug, initialReviews, reviewCount, rating }: Props) {
  const { language, t } = useLanguage();
  const [reviews, setReviews] = useState(initialReviews);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(reviewCount > initialReviews.length);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/public/products/${encodeURIComponent(slug)}/reviews?page=${nextPage}`,
        { headers: { Accept: 'application/json' } },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        reviews?: ProductDetailReview[];
        currentPage?: number;
        lastPage?: number;
      };
      if (!res.ok || !json.ok || !Array.isArray(json.reviews)) {
        setError(true);
        return;
      }
      // The backend's paging has no tie-break (backend note 19): drop repeats.
      setReviews((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...json.reviews!.filter((r) => !seen.has(r.id))];
      });
      const current = json.currentPage ?? nextPage;
      setNextPage(current + 1);
      setHasMore(current < (json.lastPage ?? current) && json.reviews.length === PER_PAGE);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="product-reviews-title" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <h2
          id="product-reviews-title"
          className="text-[11px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50"
        >
          {t.product.reviews}
        </h2>
        {reviewCount > 0 ? (
          <p className="inline-flex items-center gap-2 text-sm text-[#2D1F1F]/70">
            <Stars value={rating} size={14} />
            <span className="font-bold text-[#2D1F1F]" dir="ltr">{rating.toFixed(1)}</span>
            <span>· {t.product.reviewsCount.replace('{count}', String(reviewCount))}</span>
          </p>
        ) : null}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-[#2D1F1F]/45 border border-dashed border-[#2D1F1F]/15 rounded-xl px-6 py-8 text-center">
          {t.product.noReviews}
        </p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id} className="border border-[#2D1F1F]/8 rounded-xl p-5 bg-white">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#2D1F1F]">
                  {review.customerName ?? t.product.anonymousCustomer}
                </span>
                <span className="text-xs text-[#2D1F1F]/40">
                  {formatDate(review.createdAt, language)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <Stars value={review.rating} />
                <span className="sr-only">{`${review.rating}/5`}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                  <BadgeCheck size={12} aria-hidden />
                  {t.product.verifiedPurchase}
                </span>
              </div>
              {review.comment ? (
                <p className="mt-3 text-sm text-[#2D1F1F]/75 leading-relaxed whitespace-pre-line">
                  {review.comment}
                </p>
              ) : null}
              {review.merchantReply ? (
                <div className="mt-4 rounded-md bg-[#FAF7F2] px-4 py-3 text-sm text-[#2D1F1F]/70">
                  <p className="text-[10px] font-black tracking-[0.15em] uppercase text-[#C9A84C] mb-1">
                    {t.product.sellerReply}
                  </p>
                  <p className="leading-relaxed whitespace-pre-line">{review.merchantReply}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="inline-flex items-center gap-2 h-11 px-6 border border-[#2D1F1F]/20 rounded-md text-[11px] font-black tracking-[0.2em] uppercase text-[#2D1F1F] hover:border-[#C9A84C] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
            {t.product.loadMoreReviews}
          </button>
          {error ? (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {t.product.reviewsLoadError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
