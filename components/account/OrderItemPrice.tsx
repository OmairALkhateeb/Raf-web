'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { formatMoney } from '@/utils/formatPrice';
import type { AccountOrderItemDetail } from '@/types';

type Props = {
  item: AccountOrderItemDetail;
  currency: string;
};

/**
 * What the customer paid for one order line, kept prominent.
 *
 * The line `total` is the source of truth. Bundle lines carry the product's
 * regular `unit_price` while their total is the bundle share, so when
 * price × quantity doesn't add up to the total, the full price is shown
 * crossed out instead of a misleading "price × quantity".
 */
export default function OrderItemPrice({ item, currency }: Props) {
  const { language, t } = useLanguage();
  const money = (amount: number) =>
    formatMoney(amount, language, currency, t.common.omr);

  const unitPaid = item.salePrice ?? item.unitPrice;
  const fullPrice = unitPaid * item.quantity;
  const matchesTotal =
    Math.abs(fullPrice - item.discountTotal - item.total) < 0.0005;
  const saved = fullPrice - item.total;

  return (
    <div className="flex-shrink-0 text-end min-w-[96px]">
      <p className="text-base sm:text-lg font-bold text-[#2D1F1F] whitespace-nowrap">
        <bdi>{money(item.total)}</bdi>
      </p>
      {matchesTotal ? (
        item.quantity > 1 ? (
          <p className="mt-0.5 text-xs text-[#2D1F1F]/55 whitespace-nowrap">
            <bdi>{money(unitPaid)}</bdi> × {item.quantity}
          </p>
        ) : null
      ) : saved > 0.0005 ? (
        <p className="mt-0.5 text-xs text-[#2D1F1F]/40 line-through whitespace-nowrap">
          <bdi>{money(fullPrice)}</bdi>
        </p>
      ) : null}
      {item.discountTotal > 0 ? (
        <p className="mt-0.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          {t.account.discount} −<bdi>{money(item.discountTotal)}</bdi>
        </p>
      ) : null}
    </div>
  );
}
