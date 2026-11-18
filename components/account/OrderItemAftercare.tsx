'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  localizedLabel,
  refundStatusPresentation,
  returnStatusPresentation,
} from '@/lib/account/returns';
import { reviewStatusPresentation } from '@/lib/account/reviews';
import { formatMoney } from '@/utils/formatPrice';
import RefundLine from '@/components/account/RefundLine';
import type { AccountOrderItem, AccountOrderRefund } from '@/types';

const linkClass =
  'inline-block text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors focus-visible:outline-none focus-visible:underline';
const chipClass =
  'inline-block px-2 py-0.5 text-[9px] font-black tracking-[0.12em] uppercase rounded';

function formatDate(iso: string, language: 'en' | 'ar'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(language === 'ar' ? 'ar-OM' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type Props = {
  orderId: number;
  item: AccountOrderItem;
  currency: string;
  /** The order's refunds for this line's return (guide §9.4). */
  refunds?: AccountOrderRefund[];
  /** `null` while unknown; see RefundLine. */
  hasBankAccount?: boolean | null;
};

/**
 * Return and review state for one order line. The backend decides what is
 * allowed (`can_return`, `can_review`); this only renders it.
 */
export default function OrderItemAftercare({
  orderId,
  item,
  currency,
  refunds = [],
  hasBankAccount = null,
}: Props) {
  const { language, t } = useLanguage();
  const { returnRequest, review } = item;

  const showActions = item.canReturn || item.canReview;
  if (!showActions && !returnRequest && !review) return null;

  return (
    <div className="mt-3 space-y-3">
      {showActions ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {item.canReturn ? (
            <Link
              href={`/returns?order_id=${orderId}&order_item_id=${item.id}`}
              className={linkClass}
            >
              {t.account.requestReturn}
            </Link>
          ) : null}
          {item.canReview ? (
            <Link
              href={`/account/reviews?order_item_id=${item.id}`}
              className={linkClass}
            >
              {t.account.writeReview}
            </Link>
          ) : null}
          {item.canReturn && item.returnWindowEndsAt ? (
            <span className="text-[11px] text-[#2D1F1F]/45">
              {t.returns.returnBy.replace(
                '{date}',
                formatDate(item.returnWindowEndsAt, language),
              )}
            </span>
          ) : null}
        </div>
      ) : null}

      {returnRequest ? (
        <ReturnSummary
          returnRequest={returnRequest}
          currency={currency}
          refunds={refunds}
          hasBankAccount={hasBankAccount}
        />
      ) : null}

      {review ? <ReviewSummary review={review} /> : null}
    </div>
  );
}

function ReturnSummary({
  returnRequest,
  currency,
  refunds,
  hasBankAccount,
}: {
  returnRequest: NonNullable<AccountOrderItem['returnRequest']>;
  currency: string;
  refunds: AccountOrderRefund[];
  hasBankAccount: boolean | null;
}) {
  const { language, t } = useLanguage();
  const chip = returnStatusPresentation(returnRequest.status, t.returns);
  const refund =
    returnRequest.status === 'completed' && refunds.length === 0
      ? refundStatusPresentation(returnRequest.refundStatus, t.returns)
      : null;

  return (
    <div className="rounded-md bg-[#FAF7F2] px-3 py-2 text-xs text-[#2D1F1F]/70 space-y-1">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-[#2D1F1F]">
          {t.account.returnRequestTitle}
        </span>
        <span className={`${chipClass} ${chip.bg} ${chip.text}`}>
          {chip.label}
        </span>
        <span>
          {localizedLabel(
            returnRequest.reasonLabel,
            returnRequest.reasonLabelAr,
            language,
          )}
        </span>
        <span className="text-[#2D1F1F]/45">
          {t.returns.quantity}: {returnRequest.quantity}
        </span>
      </p>
      {returnRequest.refundAmount !== null &&
      (returnRequest.status === 'approved' ||
        returnRequest.status === 'completed') ? (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span>{t.returns.refundAmount}:</span>
          <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">
            <bdi>
              {formatMoney(
                returnRequest.refundAmount,
                language,
                currency,
                t.common.omr,
              )}
            </bdi>
          </span>
        </p>
      ) : null}
      {refund ? (
        <p className={`font-semibold ${refund.className}`}>{refund.text}</p>
      ) : null}
      {refunds.map((line) => (
        <RefundLine key={line.id} refund={line} hasBankAccount={hasBankAccount} />
      ))}
      {returnRequest.merchantNote ? (
        <p>
          {t.returns.merchantNote}: {returnRequest.merchantNote}
        </p>
      ) : null}
    </div>
  );
}

function ReviewSummary({
  review,
}: {
  review: NonNullable<AccountOrderItem['review']>;
}) {
  const { t } = useLanguage();
  const chip = reviewStatusPresentation(review.status, t.account);
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

  return (
    <div className="rounded-md bg-[#FAF7F2] px-3 py-2 text-xs text-[#2D1F1F]/70 space-y-1">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-[#2D1F1F]">
          {t.account.yourReview}
        </span>
        <span
          className="text-[#C9A84C] tracking-[0.1em]"
          dir="ltr"
          aria-label={`${t.account.reviewRating}: ${review.rating}/5`}
        >
          {stars}
        </span>
        <span className={`${chipClass} ${chip.bg} ${chip.text}`}>
          {chip.label}
        </span>
      </p>
      {review.comment ? <p>{review.comment}</p> : null}
      {review.merchantReply ? (
        <p>
          <span className="font-bold">{t.account.reviewMerchantReply}:</span>{' '}
          {review.merchantReply}
        </p>
      ) : null}
    </div>
  );
}
