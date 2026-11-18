import type { Language } from '@/types';
import type { Dictionary } from '@/utils/translations';

type AccountDict = Dictionary['account'];

/**
 * `shipments.courier_name` is the backend's shipping driver key (`log`,
 * `dalilee`) or free text typed by the merchant (backend note 36).
 */
export function isDalileeCourier(name: string | null): boolean {
  return name?.trim().toLowerCase() === 'dalilee';
}

/** The backend's display name in the UI language, when it sends one (#36). */
function backendLabel(
  display: { label: string | null; labelAr: string | null; language: Language } | undefined,
): string | null {
  if (!display?.label) return null;
  return display.language === 'ar' && display.labelAr ? display.labelAr : display.label;
}

/**
 * The backend's display name first (e.g. «توصيل رف» for `log`), else our own
 * mapping. `null`: nothing to show.
 */
export function courierLabel(
  name: string | null,
  t: AccountDict,
  display?: { label: string | null; labelAr: string | null; language: Language },
): string | null {
  const fromBackend = backendLabel(display);
  if (fromBackend) return fromBackend;
  const value = name?.trim();
  if (!value) return null;
  const key = value.toLowerCase();
  if (key === 'log') return null;
  if (key === 'dalilee') return t.courierDalilee;
  return value;
}

/** The backend's label first; else known providers only (an unknown key is never shown raw). */
export function paymentProviderLabel(
  provider: string | null | undefined,
  t: AccountDict,
  display?: { label: string | null; labelAr: string | null; language: Language },
): string | null {
  const fromBackend = backendLabel(display);
  if (fromBackend) return fromBackend;
  switch (provider?.trim().toLowerCase()) {
    case 'mock':
      return t.paymentProviderMock;
    case 'thawani':
      return t.paymentProviderThawani;
    default:
      return null;
  }
}
