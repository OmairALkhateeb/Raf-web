import 'server-only';

import type { DeliveryZone } from '@/lib/account/delivery-cities';
import { apiGet, isTransportFailure } from './http';

// Zones change rarely; an admin's new zone shows within five minutes.
const ZONES_REVALIDATE_SECONDS = 300;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * GET /api/public/shipping-zones → one entry per city (zones may repeat a
 * city for several areas). `null` when the backend can't be reached.
 */
export async function fetchShippingZones(): Promise<DeliveryZone[] | null> {
  let payload: { data?: unknown };
  try {
    payload = await apiGet<{ data?: unknown }>('/public/shipping-zones', {
      revalidate: ZONES_REVALIDATE_SECONDS,
      tags: ['shipping-zones'],
    });
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error('[shipping-zones] failed to load /api/public/shipping-zones', error);
    return null;
  }

  const zones: DeliveryZone[] = [];
  for (const row of Array.isArray(payload?.data) ? payload.data : []) {
    const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
    const city = text(record?.city);
    if (!city) continue;
    const existing = zones.find((zone) => zone.city.toLowerCase() === city.toLowerCase());
    const cityAr = text(record?.city_ar);
    if (existing) {
      existing.cityAr ??= cityAr;
      continue;
    }
    zones.push({ city, cityAr });
  }
  return zones;
}
