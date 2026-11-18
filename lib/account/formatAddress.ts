import type { Address, Language } from '@/types';
import type { Dictionary } from '@/utils/translations';
import { deliveryCityLabel, type DeliveryZone } from '@/lib/account/delivery-cities';

/**
 * Ordered visible parts for cards and checkout; skips null/blank values.
 * A delivery city is shown in the UI language.
 */
export function formatCustomerAddressParts(
  addr: Address,
  t: Dictionary,
  zones?: DeliveryZone[],
  language?: Language,
): string[] {
  return [
    addr.street,
    addr.addressLine2,
    addr.area,
    addr.city ? deliveryCityLabel(addr.city, t, zones, language) : addr.city,
    addr.postalCode,
    addr.country,
  ].filter((part): part is string => Boolean(part && part.trim()));
}
