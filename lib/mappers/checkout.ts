import 'server-only';

import type { CouponPreview, ShippingMethodOption } from '@/types';
import { deliveryAvailable } from '@/lib/mappers/cart';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function money(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hours(value: unknown): number | null {
  const n = money(value);
  return n !== null && n >= 0 ? n : null;
}

/** ShippingMethodResource collection (`{ data: [...] }`). Malformed rows are skipped. */
export function parseShippingMethods(raw: unknown): ShippingMethodOption[] | undefined {
  const record = asRecord(raw);
  const rows = Array.isArray(record?.data) ? record.data : Array.isArray(raw) ? raw : undefined;
  if (!rows) return undefined;

  const methods: ShippingMethodOption[] = [];
  for (const row of rows) {
    const dto = asRecord(row);
    const id = typeof dto?.id === 'number' && Number.isInteger(dto.id) && dto.id > 0 ? dto.id : null;
    const name = text(dto?.name);
    if (!dto || id === null || !name) {
      console.error('Laravel shipping method could not be mapped');
      continue;
    }
    const zoneAvailable = dto.zone_available === true;
    // `available` (15/10/2026) is the real answer: a zone may not offer every
    // method. An older API without it falls back to the zone.
    const available =
      dto.available === undefined ? zoneAvailable : zoneAvailable && dto.available === true;
    methods.push({
      id,
      code: text(dto.code) ?? String(id),
      name,
      nameAr: text(dto.name_ar),
      description: text(dto.description),
      descriptionAr: text(dto.description_ar),
      // An unavailable method can come back as "0.000": that isn't free
      // shipping, so it gets no price at all.
      price: available ? money(dto.price) : null,
      baseFee: money(dto.base_fee),
      freeShippingThreshold: (() => {
        const threshold = money(dto.free_shipping_threshold);
        return threshold !== null && threshold > 0 ? threshold : null;
      })(),
      durationHours: hours(dto.duration_hours),
      preparationHours: hours(dto.preparation_hours),
      zoneAvailable,
      available,
    });
  }
  return methods;
}

export function parseCouponPreview(raw: unknown): CouponPreview | undefined {
  const dto = asRecord(raw);
  if (!dto || dto.valid !== true) return undefined;
  const couponCode = text(dto.coupon_code);
  const subtotal = money(dto.subtotal);
  const discountTotal = money(dto.discount_total);
  if (!couponCode || subtotal === null || discountTotal === null) return undefined;
  return {
    couponCode,
    couponType: text(dto.coupon_type),
    freeShipping: dto.free_shipping === true,
    subtotal,
    discountTotal,
    shippingTotal: money(dto.shipping_total),
    shippingAvailable: deliveryAvailable(dto.shipping_available),
    taxTotal: money(dto.tax_total),
    grandTotal: money(dto.grand_total),
  };
}
