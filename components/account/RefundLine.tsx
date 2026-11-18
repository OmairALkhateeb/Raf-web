'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { refundLineKind } from '@/lib/account/refunds';
import { REFUND_ACCOUNT_HREF } from '@/lib/account/refund-account';
import { formatMoney } from '@/utils/formatPrice';
import type { AccountOrderRefund } from '@/types';

function formatDay(iso: string, language: 'en' | 'ar'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(language === 'ar' ? 'ar-OM' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** `template` with `{amount}` replaced by a left-to-right amount. */
function withAmount(template: string, amount: ReactNode): ReactNode {
  const [before, after = ''] = template.split('{amount}');
  return (
    <>
      {before}
      <bdi className="font-bold whitespace-nowrap">{amount}</bdi>
      {after}
    </>
  );
}

const TONE = {
  done: 'text-emerald-700',
  waiting: 'text-amber-800',
  neutral: 'text-[#2D1F1F]/70',
} as const;

/**
 * One refund from the order's `refunds[]` (guide §9.4): back on the card,
 * transferred (with the bank reference), on its way, or waiting for the
 * customer's bank account.
 */
export default function RefundLine({
  refund,
  hasBankAccount,
}: {
  refund: AccountOrderRefund;
  /** `null` while the profile is loading or couldn't be read. */
  hasBankAccount: boolean | null;
}) {
  const { language, t } = useLanguage();
  const amount = formatMoney(refund.amount, language, refund.currency, t.common.omr);
  const kind = refundLineKind(refund, hasBankAccount);

  switch (kind) {
    case 'card_done':
      return <p className={TONE.done}>{withAmount(t.account.refundToCard, amount)}</p>;
    case 'transfer_done': {
      const details = [
        refund.bankReference ? (
          <span key="ref">
            {t.account.refundReference.split('{reference}')[0]}
            <bdi dir="ltr" className="font-medium">
              {refund.bankReference}
            </bdi>
            {t.account.refundReference.split('{reference}')[1] ?? ''}
          </span>
        ) : null,
        refund.transferredAt ? (
          <span key="date">{formatDay(refund.transferredAt, language)}</span>
        ) : null,
      ].filter(Boolean);
      return (
        <p className={TONE.done}>
          {withAmount(t.account.refundTransferred, amount)}
          {details.length > 0 ? (
            <>
              {' ('}
              {details.map((part, index) => (
                <span key={index}>
                  {index > 0 ? t.common.listSeparator : null}
                  {part}
                </span>
              ))}
              {')'}
            </>
          ) : null}
          .
        </p>
      );
    }
    case 'transfer_waiting':
      return <p className={TONE.waiting}>{withAmount(t.account.refundWillTransfer, amount)}</p>;
    case 'transfer_needs_account':
      return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className={TONE.waiting}>{withAmount(t.account.refundAddBankAccount, amount)}</p>
          <Link
            href={REFUND_ACCOUNT_HREF}
            className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.15em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
          >
            <Landmark size={12} aria-hidden />
            {t.account.refundAddBankAccountAction}
          </Link>
        </div>
      );
    default:
      return <p className={TONE.neutral}>{withAmount(t.account.refundInProgress, amount)}</p>;
  }
}
