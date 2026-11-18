'use client';

import { useEffect, useState } from 'react';
import { FALLBACK_ZONES, type DeliveryZone } from './delivery-cities';

let cached: DeliveryZone[] | null = null;
let pending: Promise<DeliveryZone[] | null> | null = null;

function loadZones(): Promise<DeliveryZone[] | null> {
  pending ??= fetch('/api/shipping-zones', { headers: { Accept: 'application/json' } })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = (await res.json()) as { zones?: unknown };
      const zones = Array.isArray(body.zones) ? (body.zones as DeliveryZone[]) : null;
      if (zones && zones.length > 0) cached = zones;
      return cached;
    })
    .catch(() => null)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/**
 * The backend's delivery cities (loaded once per page visit). Until they
 * arrive, or if the call fails, the old fixed list is used.
 */
export function useDeliveryZones(): DeliveryZone[] {
  const [zones, setZones] = useState<DeliveryZone[]>(cached ?? FALLBACK_ZONES);
  useEffect(() => {
    if (cached) return;
    let active = true;
    void loadZones().then((loaded) => {
      if (active && loaded) setZones(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return zones;
}
