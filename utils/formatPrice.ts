export function formatMoney(
  amount: number,
  language: 'en' | 'ar',
  currency: string | undefined,
  omrLabel: string,
): string {
  const value = Number(amount).toFixed(3);
  const code = (currency ?? 'OMR').trim() || 'OMR';
  const label = code.toUpperCase() === 'OMR' ? omrLabel : code;
  return language === 'ar' ? `${value} ${label}` : `${label} ${value}`;
}

/** @deprecated Prefer formatMoney with t.common.omr so non-OMR codes stay intact. */
export const formatPrice = (
  price: number,
  currency = 'OMR',
  lang: 'en' | 'ar' | string = 'en',
  omrLabel?: string,
): string => {
  const language = lang === 'ar' ? 'ar' : 'en';
  return formatMoney(
    price,
    language,
    currency,
    omrLabel ?? 'OMR',
  );
};

export const formatDiscount = (original: number, sale: number): number => {
  return Math.round(((original - sale) / original) * 100);
};
