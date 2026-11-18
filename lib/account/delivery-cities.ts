import type { Language } from '@/types';
import type { Dictionary } from '@/utils/translations';

/**
 * Cities the backend delivers to. Since 08/10/2026 they come from
 * GET /public/shipping-zones (backend note 35, checklist H3) through the
 * store's `/api/shipping-zones`. The backend matches an address to a zone by
 * `city` in English or Arabic, so the store sends the zone's `city` as listed.
 */
export interface DeliveryZone {
  city: string;
  /** Arabic name for display; `null` when the admin hasn't set one. */
  cityAr: string | null;
}

/** Used until the zones load, or when the call fails (the old fixed list, A8). */
export const DELIVERY_CITIES = ['Muscat', 'Salalah', 'Sohar', 'Nizwa'] as const;

export const FALLBACK_ZONES: DeliveryZone[] = DELIVERY_CITIES.map((city) => ({ city, cityAr: null }));

type FixedCity = (typeof DELIVERY_CITIES)[number];

const LABEL_KEYS: Record<FixedCity, keyof Dictionary['deliveryCities']> = {
  Muscat: 'muscat',
  Salalah: 'salalah',
  Sohar: 'sohar',
  Nizwa: 'nizwa',
};

/** Every zone is in Oman. */
export const DELIVERY_COUNTRY = 'OM';

function findZone(value: string | null | undefined, zones: DeliveryZone[]): DeliveryZone | null {
  const needle = value?.trim().toLowerCase();
  if (!needle) return null;
  return (
    zones.find(
      (zone) => zone.city.toLowerCase() === needle || zone.cityAr?.trim().toLowerCase() === needle,
    ) ?? null
  );
}

/**
 * The zone's `city` for a saved/typed value (English or Arabic, any case), or
 * null when no zone matches.
 */
export function findDeliveryCity(
  value: string | null | undefined,
  zones: DeliveryZone[] = FALLBACK_ZONES,
): string | null {
  return findZone(value, zones)?.city ?? null;
}

/** A delivery city in the UI language; any other saved value as it is. */
export function deliveryCityLabel(
  value: string,
  t: Dictionary,
  zones: DeliveryZone[] = FALLBACK_ZONES,
  language?: Language,
): string {
  const zone = findZone(value, zones);
  if (zone && language === 'ar' && zone.cityAr) return zone.cityAr;
  const city = zone?.city ?? value;
  const fixed = DELIVERY_CITIES.find((name) => name.toLowerCase() === city.toLowerCase());
  return fixed ? t.deliveryCities[LABEL_KEYS[fixed]] : city;
}
