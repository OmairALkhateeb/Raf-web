'use client';

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import AccountSidebar from '@/components/account/AccountSidebar';
import { createReview, deleteReview, fetchReviews, updateReview } from '@/lib/api/account';
import { pickLocalized } from '@/lib/i18n/language';
import Link from 'next/link';
import { localizeReviewError } from '@/lib/account/messages';
import {
  parseOrderItemIdParam,
  reviewStatusPresentation,
} from '@/lib/account/reviews';
import type { AccountReview } from '@/types';
import { AccountPageSkeleton, ListSkeleton } from '@/components/common/Loading';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';
const inputClass =
  'w-full h-11 px-4 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';
const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

function formatDate(iso: string, language: 'en' | 'ar'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(language === 'ar' ? 'ar-OM' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={
            n <= rating
              ? 'fill-[#C9A84C] text-[#C9A84C]'
              : 'text-[#2D1F1F]/20'
          }
          aria-hidden
        />
      ))}
    </div>
  );
}

export default function AccountReviewsPage() {
  return (
    <Suspense fallback={<ReviewsLoadingFallback />}>
      <AccountReviewsContent />
    </Suspense>
  );
}

function ReviewsLoadingFallback() {
  const { t } = useLanguage();
  return <AccountPageSkeleton label={t.common.loading} />;
}

function AccountReviewsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, t, isRTL } = useLanguage();
  const { showToast } = useApp();
  const { user, isAuthenticated, isAuthLoading, logout } = useAuth();

  const prefillItemId = parseOrderItemIdParam(
    searchParams.get('order_item_id'),
  );

  const [reviews, setReviews] = useState<AccountReview[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);

  const [formOpen, setFormOpen] = useState(Boolean(prefillItemId));
  const [orderItemIdOverride, setOrderItemIdOverride] = useState<string | null>(
    null,
  );
  const orderItemId =
    orderItemIdOverride ?? (prefillItemId ? String(prefillItemId) : '');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  /** Set while the form edits an existing review instead of writing a new one. */
  const [editingReview, setEditingReview] = useState<AccountReview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountReview | null>(null);
  const [deleting, setDeleting] = useState(false);
  const submittingRef = useRef(false);
  const epochRef = useRef(0);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  const handleAuthFailure = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [logout, router]);

  const loadReviews = useCallback(async () => {
    const epoch = ++epochRef.current;
    setListLoading(true);
    setListError(false);
    const result = await fetchReviews();
    if (epoch !== epochRef.current) return;
    if (!result.ok) {
      if (result.code === 'unauthenticated') {
        await handleAuthFailure();
        return;
      }
      setReviews([]);
      setListError(true);
      setListLoading(false);
      return;
    }
    setReviews(result.data.reviews);
    setListLoading(false);
  }, [handleAuthFailure]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      await loadReviews();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, loadReviews]);

  const closeForm = useCallback(() => {
    if (submittingRef.current) return;
    setFormOpen(false);
    setFieldErrors({});
    setEditingReview(null);
  }, []);

  const openEdit = (review: AccountReview) => {
    setEditingReview(review);
    setRating(review.rating);
    setComment(review.comment ?? '');
    setFieldErrors({});
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const result = await deleteReview(deleteTarget.id);
    setDeleting(false);
    if (!result.ok) {
      if (result.code === 'unauthenticated') {
        await handleAuthFailure();
        return;
      }
      showToast(localizeReviewError(result, t), 'error');
      return;
    }
    setDeleteTarget(null);
    showToast(t.account.reviewDeleted, 'success');
    await loadReviews();
  };

  useEffect(() => {
    if (!formOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeForm();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [formOpen, closeForm]);

  const handleLogout = async () => {
    await logout();
    showToast(t.common.signedOut, 'success');
    router.push('/');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || submitting) return;

    setFieldErrors({});
    const itemId = editingReview ? null : parseOrderItemIdParam(orderItemId.trim());
    const nextErrors: Record<string, string> = {};
    if (!editingReview && itemId === null) {
      nextErrors.order_item_id = t.account.invalidOrderItemId;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      nextErrors.rating = t.account.ratingInvalid;
    }
    if (comment.trim().length > 2000) {
      nextErrors.comment = t.account.commentTooLong;
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = editingReview
        ? await updateReview(editingReview.id, {
            rating,
            comment: comment.trim() ? comment.trim() : null,
          })
        : await createReview({
            orderItemId: itemId!,
            rating,
            comment: comment.trim() ? comment.trim() : null,
          });
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await handleAuthFailure();
          return;
        }
        if (result.fields) {
          setFieldErrors(result.fields);
        }
        showToast(localizeReviewError(result, t), 'error');
        return;
      }
      showToast(editingReview ? t.account.reviewUpdated : t.account.reviewCreated, 'success');
      setEditingReview(null);
      setFormOpen(false);
      setRating(0);
      setComment('');
      setOrderItemIdOverride(null);
      await loadReviews();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (isAuthLoading || !isAuthenticated || !user) {
    return <AccountPageSkeleton label={t.common.loading} />;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.account.title}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.account.myReviews}
          </h1>
        </div>
      </div>

      <div className={`${cx} py-14 sm:py-20`}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10">
          <AccountSidebar user={user} onLogout={() => void handleLogout()} />

          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-[#2D1F1F]/45 leading-relaxed max-w-xl">
                {t.account.reviewFormHint}
              </p>
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="shrink-0 h-11 px-5 bg-[#2D1F1F] text-white text-[10px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors"
              >
                {t.account.writeReview}
              </button>
            </div>

            {listLoading ? (
              <ListSkeleton rows={3} label={t.common.loading} />
            ) : listError ? (
              <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-12 text-center">
                <p className="text-sm text-[#2D1F1F]/55 mb-4" role="alert">
                  {t.account.reviewsLoadError}
                </p>
                <button
                  type="button"
                  onClick={() => void loadReviews()}
                  className="hit-area text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F]"
                >
                  {t.common.retry}
                </button>
              </div>
            ) : reviews.length === 0 ? (
              <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-16 text-center">
                <Star
                  size={32}
                  strokeWidth={1}
                  className="text-[#2D1F1F]/15 mx-auto mb-4"
                />
                <p className="text-sm text-[#2D1F1F]/40">
                  {t.account.noReviewsYet}
                </p>
              </div>
            ) : (
              <ul className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden divide-y divide-[#2D1F1F]/8">
                {reviews.map((row) => {
                  const chip = reviewStatusPresentation(row.status, t.account);
                  const title = row.productName
                    ? pickLocalized(language, row.productName, row.productNameAr)
                    : `${t.account.reviewProductFallback} #${row.productId}`;
                  return (
                    <li
                      key={row.id}
                      className="px-6 py-5 flex gap-4"
                    >
                      <div className="relative w-16 h-16 overflow-hidden bg-[#F5F3EF] border border-[#2D1F1F]/8 rounded-md flex-shrink-0">
                        <Image
                          src={row.productImageUrl}
                          alt={title}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                      <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : ''}`}>
                        <div
                          className="flex flex-wrap items-center gap-3 mb-2"
                        >
                          <p className="text-sm font-bold text-[#2D1F1F]">
                            {row.productSlug ? (
                              <Link
                                href={`/products/${encodeURIComponent(row.productSlug)}`}
                                className="hover:text-[#C9A84C] transition-colors"
                              >
                                {title}
                              </Link>
                            ) : (
                              title
                            )}
                          </p>
                          <span
                            className={`px-3 py-1 text-[10px] font-black tracking-[0.12em] uppercase rounded-md ${chip.bg} ${chip.text}`}
                          >
                            {chip.label}
                          </span>
                        </div>
                        <StarDisplay rating={row.rating} />
                        <p className="text-xs text-[#2D1F1F]/40 mt-2">
                          {formatDate(row.createdAt, language)}
                          {row.verifiedPurchase
                            ? ` · ${t.account.reviewVerifiedPurchase}`
                            : ''}
                        </p>
                        {row.comment ? (
                          <p className="text-sm text-[#2D1F1F] mt-3 leading-relaxed">
                            {row.comment}
                          </p>
                        ) : null}
                        {row.merchantReply ? (
                          <div className="mt-3 border border-[#2D1F1F]/8 rounded-md px-4 py-3 bg-[#FAF7F2]">
                            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                              {t.account.reviewMerchantReply}
                            </p>
                            <p className="text-sm text-[#2D1F1F] leading-relaxed">
                              {row.merchantReply}
                            </p>
                            {row.merchantRepliedAt ? (
                              <p className="text-xs text-[#2D1F1F]/40 mt-1">
                                {formatDate(row.merchantRepliedAt, language)}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-3 flex gap-4">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="hit-area text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F]"
                          >
                            {t.account.reviewEdit}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row)}
                            className="text-[10px] font-black tracking-[0.2em] uppercase text-red-500 hover:text-red-700"
                          >
                            {t.account.reviewDelete}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' && deleteTarget
        ? createPortal(
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => (deleting ? null : setDeleteTarget(null))}
                aria-hidden="true"
              />
              <div
                dir={isRTL ? 'rtl' : 'ltr'}
                className="relative z-10 w-full max-w-sm bg-white rounded-xl shadow-2xl p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-review-title"
              >
                <h2 id="delete-review-title" className="text-base font-serif font-bold text-[#2D1F1F] mb-2">
                  {t.account.reviewDeleteConfirmTitle}
                </h2>
                <p className="text-sm text-[#2D1F1F]/50 mb-6 leading-relaxed">
                  {t.account.reviewDeleteConfirmDesc}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => void confirmDelete()}
                    disabled={deleting}
                    className="flex-1 h-11 bg-red-500 text-white text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-red-600 transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                    {t.account.reviewDeleteConfirmAction}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                    className="flex-1 h-11 border border-[#2D1F1F]/15 text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#FAF7F2] transition-colors disabled:opacity-40"
                  >
                    {t.account.reviewKeep}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {formOpen ? (
                <motion.div
                  key="write-review-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                >
                  <div
                    className="absolute inset-0 bg-black/40"
                    onClick={closeForm}
                    aria-hidden="true"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{
                      type: 'spring',
                      damping: 28,
                      stiffness: 320,
                    }}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl max-h-[min(90vh,100%)] overflow-y-auto"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="write-review-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-6 sm:p-8">
                      <h2
                        id="write-review-title"
                        className="text-lg font-serif text-[#2D1F1F] mb-1"
                      >
                        {editingReview ? t.account.reviewEditTitle : t.account.reviewFormTitle}
                      </h2>
                      <p className="text-sm text-[#2D1F1F]/45 mb-6 leading-relaxed">
                        {editingReview ? t.account.reviewEditHint : t.account.reviewFormHint}
                      </p>

                      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
                        <div className={editingReview ? 'hidden' : 'mb-4'}>
                          <label
                            htmlFor="review-order-item"
                            className={labelClass}
                          >
                            {t.account.reviewOrderItemId}
                          </label>
                          <input
                            id="review-order-item"
                            type="text"
                            inputMode="numeric"
                            value={orderItemId}
                            onChange={(e) =>
                              setOrderItemIdOverride(e.target.value)
                            }
                            disabled={submitting}
                            className={inputClass}
                            autoComplete="off"
                          />
                          {fieldErrors.order_item_id ? (
                            <p className="mt-2 text-xs text-red-600" role="alert">
                              {fieldErrors.order_item_id}
                            </p>
                          ) : null}
                        </div>

                        <div className="mb-4">
                          <p className={labelClass} id="review-rating-label">
                            {t.account.reviewRating}
                          </p>
                          <div
                            className="flex gap-1"
                            role="radiogroup"
                            aria-labelledby="review-rating-label"
                            aria-label={t.account.reviewStarsLabel}
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                role="radio"
                                aria-checked={rating === n}
                                aria-label={`${n} / 5`}
                                disabled={submitting}
                                onClick={() => {
                                  setRating(n);
                                  setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.rating;
                                    return next;
                                  });
                                }}
                                className="p-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] disabled:opacity-50"
                              >
                                <Star
                                  size={22}
                                  className={
                                    n <= rating
                                      ? 'fill-[#C9A84C] text-[#C9A84C]'
                                      : 'text-[#2D1F1F]/25'
                                  }
                                  aria-hidden
                                />
                              </button>
                            ))}
                          </div>
                          {fieldErrors.rating ? (
                            <p className="mt-2 text-xs text-red-600" role="alert">
                              {fieldErrors.rating}
                            </p>
                          ) : null}
                        </div>

                        <div className="mb-6">
                          <label htmlFor="review-comment" className={labelClass}>
                            {t.account.reviewCommentOptional}
                          </label>
                          <textarea
                            id="review-comment"
                            rows={4}
                            maxLength={2000}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            disabled={submitting}
                            placeholder={t.account.reviewCommentPlaceholder}
                            className="w-full px-4 py-3 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors resize-y"
                          />
                          {fieldErrors.comment ? (
                            <p className="mt-2 text-xs text-red-600" role="alert">
                              {fieldErrors.comment}
                            </p>
                          ) : null}
                        </div>

                        <div
                          className="flex gap-3"
                        >
                          <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 h-11 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
                          >
                            {submitting ? (
                              <Loader2
                                size={14}
                                className="animate-spin"
                                aria-hidden
                              />
                            ) : null}
                            {submitting
                              ? t.account.submittingReview
                              : t.account.submitReview}
                          </button>
                          <button
                            type="button"
                            onClick={closeForm}
                            disabled={submitting}
                            className="flex-1 h-11 border border-[#2D1F1F]/15 text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#FAF7F2] transition-colors disabled:opacity-40"
                          >
                            {t.account.closeReviewForm}
                          </button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
