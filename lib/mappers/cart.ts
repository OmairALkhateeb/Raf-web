import 'server-only';

import type { CartBundleLine, CartItem, CartMergeNote, CartSnapshot, CartTotals } from '@/types';
import type {
  LaravelCartBundleLineDto,
  LaravelCartDto,
  LaravelCartIssueDto,
  LaravelCartLineDto,
} from '@/types/api/cart';
import { PLACEHOLDER_MEDIA } from '@/lib/mappers/product';
import { resolveMediaUrl } from '@/lib/api/server/media';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function positiveInt(value: unknown): number | undefined {
  const n = finiteNumber(value);
  if (n === undefined || !Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

/** `options.attributes` → `{ Size: '100ml' }`; scalar values only. */
function mapOptions(raw: LaravelCartLineDto['options']): Record<string, string> | null {
  const attributes = asRecord(asRecord(raw)?.attributes);
  if (!attributes) return null;
  const options: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(attributes)) {
    const key = rawKey.trim();
    if (!key) continue;
    if (typeof value === 'string' && value.trim()) options[key] = value.trim();
    else if (typeof value === 'number' || typeof value === 'boolean') options[key] = String(value);
  }
  return Object.keys(options).length > 0 ? options : null;
}

function mapLine(raw: unknown): CartItem | null {
  const dto = asRecord(raw) as LaravelCartLineDto | null;
  if (!dto) return null;

  const itemId = positiveInt(dto.item_id);
  const productId = positiveInt(dto.product_id);
  const quantity = positiveInt(dto.quantity);
  const unitPrice = finiteNumber(dto.unit_price);
  const lineTotal = finiteNumber(dto.line_total);
  const availableStock = finiteNumber(dto.available_stock);
  const name = typeof dto.name === 'string' ? dto.name.trim() : '';

  if (
    itemId === undefined ||
    productId === undefined ||
    quantity === undefined ||
    unitPrice === undefined ||
    lineTotal === undefined ||
    availableStock === undefined ||
    !name
  ) {
    return null;
  }

  let variantId: number | null = null;
  if (dto.variant_id !== null && dto.variant_id !== undefined) {
    const parsed = positiveInt(dto.variant_id);
    if (parsed === undefined) return null;
    variantId = parsed;
  }

  const imageUrl = resolveMediaUrl(typeof dto.image_url === 'string' ? dto.image_url : null) ?? PLACEHOLDER_MEDIA;

  return {
    itemId,
    productId,
    variantId,
    name,
    imageUrl,
    unitPrice,
    quantity,
    lineTotal,
    availableStock,
    nameAr:
      typeof dto.name_ar === 'string' && dto.name_ar.trim()
        ? dto.name_ar.trim()
        : null,
    slug:
      typeof dto.slug === 'string' && dto.slug.trim() ? dto.slug.trim() : null,
    variantSku:
      typeof dto.variant_sku === 'string' && dto.variant_sku.trim()
        ? dto.variant_sku.trim()
        : null,
    options: mapOptions(dto.options),
  };
}

function mapBundleLine(raw: unknown): CartBundleLine | null {
  const dto = asRecord(raw) as LaravelCartBundleLineDto | null;
  if (!dto) return null;
  const bundleItemId = positiveInt(dto.bundle_item_id);
  const bundleId = positiveInt(dto.bundle_id);
  const quantity = positiveInt(dto.quantity);
  const unitPrice = finiteNumber(dto.unit_price);
  const lineTotal = finiteNumber(dto.line_total);
  const name = typeof dto.name === 'string' ? dto.name.trim() : '';
  const slug = typeof dto.slug === 'string' ? dto.slug.trim() : '';
  if (
    bundleItemId === undefined ||
    bundleId === undefined ||
    quantity === undefined ||
    unitPrice === undefined ||
    lineTotal === undefined ||
    !name ||
    !slug
  ) {
    return null;
  }

  const contents: CartBundleLine['contents'] = [];
  for (const row of Array.isArray(dto.contents) ? dto.contents : []) {
    const productId = positiveInt(row?.product_id);
    const qty = positiveInt(row?.quantity);
    const itemName = typeof row?.name === 'string' ? row.name.trim() : '';
    if (productId === undefined || qty === undefined || !itemName) continue;
    contents.push({
      productId,
      name: itemName,
      nameAr: typeof row.name_ar === 'string' && row.name_ar.trim() ? row.name_ar.trim() : null,
      variantId: positiveInt(row.variant_id) ?? null,
      variantLabel: typeof row.variant_label === 'string' && row.variant_label.trim() ? row.variant_label.trim() : null,
      variantLabelAr:
        typeof row.variant_label_ar === 'string' && row.variant_label_ar.trim() ? row.variant_label_ar.trim() : null,
      quantity: qty,
    });
  }

  return {
    bundleItemId,
    bundleId,
    name,
    nameAr: typeof dto.name_ar === 'string' && dto.name_ar.trim() ? dto.name_ar.trim() : null,
    slug,
    imageUrl: resolveMediaUrl(typeof dto.image_url === 'string' ? dto.image_url : null) ?? PLACEHOLDER_MEDIA,
    unitPrice,
    comparePrice: finiteNumber(dto.compare_price) ?? null,
    quantity,
    lineTotal,
    contents,
  };
}

/**
 * Issues come as English sentences (backend note 21), matched exactly:
 * - items: "Product no longer available." / "Only N left in stock."
 * - bundles: "This bundle is no longer available.", "\"…\" contains a product
 *   (or variant) that is no longer available.", "Insufficient stock for \"…\"."
 */
function mapIssue(raw: unknown): CartSnapshot['issues'][number] | null {
  const dto = asRecord(raw) as LaravelCartIssueDto | null;
  if (!dto) return null;
  const itemId = positiveInt(dto.item_id) ?? null;
  const bundleItemId = positiveInt(dto.bundle_item_id) ?? null;
  if (itemId === null && bundleItemId === null) return null;

  const available = finiteNumber(dto.available);
  const availableCount = available !== undefined && available >= 0 ? Math.floor(available) : null;

  // The code first (#21); the English sentence for older payloads.
  if (dto.code === 'unavailable' || dto.code === 'bundle_unavailable') {
    return { itemId, bundleItemId, reason: 'unavailable', available: null };
  }
  if (dto.code === 'stock' || dto.code === 'bundle_stock') {
    return { itemId, bundleItemId, reason: 'stock', available: availableCount };
  }

  const reasonText = typeof dto.reason === 'string' ? dto.reason : '';
  let reason: CartSnapshot['issues'][number]['reason'] = 'unknown';
  if (
    reasonText === 'Product no longer available.' ||
    reasonText === 'This bundle is no longer available.' ||
    /contains a (product|variant) that is no longer available\.$/.test(reasonText)
  ) {
    reason = 'unavailable';
  } else if (
    /^Only \d+ left in stock\.$/.test(reasonText) ||
    /^Insufficient stock for ".*"\.$/.test(reasonText)
  ) {
    reason = 'stock';
  }

  return { itemId, bundleItemId, reason, available: reason === 'stock' ? availableCount : null };
}

/** `merge_notes` from the login merge (#30); invalid rows are skipped. */
function mapMergeNotes(raw: LaravelCartDto['merge_notes']): CartMergeNote[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const notes: CartMergeNote[] = [];
  for (const row of raw) {
    const name = typeof row?.name === 'string' ? row.name.trim() : '';
    if (!name || (row.code !== 'dropped' && row.code !== 'capped')) continue;
    notes.push({
      name,
      nameAr: typeof row.name_ar === 'string' && row.name_ar.trim() ? row.name_ar.trim() : null,
      code: row.code,
      requested: positiveInt(row.requested) ?? null,
      merged: finiteNumber(row.merged) ?? null,
    });
  }
  return notes;
}

/**
 * `shipping_available` (15/10/2026): `true` / `false` as sent; anything else
 * (missing on an older API, or `null` while the shipping is estimated) is
 * `null`, "unknown", which the pages treat as before.
 */
export function deliveryAvailable(value: unknown): boolean | null {
  return value === true ? true : value === false ? false : null;
}

/** All totals or none: a partial set would show a wrong grand total. */
function mapTotals(dto: LaravelCartDto): CartTotals | null {
  const discountTotal = finiteNumber(dto.discount_total);
  const shippingTotal = finiteNumber(dto.shipping_total);
  const taxTotal = finiteNumber(dto.tax_total);
  const taxRate = finiteNumber(dto.tax_rate);
  const grandTotal = finiteNumber(dto.grand_total);
  if (
    discountTotal === undefined ||
    shippingTotal === undefined ||
    taxTotal === undefined ||
    taxRate === undefined ||
    grandTotal === undefined
  ) {
    return null;
  }
  const threshold = finiteNumber(dto.free_shipping_threshold);
  return {
    discountTotal,
    shippingTotal,
    taxTotal,
    taxRate,
    grandTotal,
    freeShippingThreshold: threshold !== undefined && threshold > 0 ? threshold : null,
    shippingEstimated: dto.shipping_estimated === true,
    shippingAvailable: deliveryAvailable(dto.shipping_available),
    shippingAddressId: positiveInt(dto.shipping_address_id) ?? null,
    shippingMethodId: positiveInt(dto.shipping_method_id) ?? null,
  };
}

/**
 * Maps a Laravel cart payload to UI types. Invalid lines are dropped (never
 * fabricated). A missing/non-finite subtotal or cart_id fails the whole snapshot.
 */
export function toCartSnapshot(payload: unknown): CartSnapshot | null {
  const dto = asRecord(payload) as LaravelCartDto | null;
  if (!dto) return null;

  const cartId = positiveInt(dto.cart_id);
  const subtotal = finiteNumber(dto.subtotal);
  const currency = typeof dto.currency === 'string' && dto.currency.trim() ? dto.currency.trim() : undefined;
  if (cartId === undefined || subtotal === undefined || !currency) return null;
  if (!Array.isArray(dto.items) || !Array.isArray(dto.issues)) return null;

  const items: CartItem[] = [];
  for (const row of dto.items) {
    const line = mapLine(row);
    if (line) items.push(line);
  }

  const bundles: CartBundleLine[] = [];
  for (const row of Array.isArray(dto.bundles) ? dto.bundles : []) {
    const line = mapBundleLine(row);
    if (line) bundles.push(line);
  }

  const issues: CartSnapshot['issues'] = [];
  for (const row of dto.issues) {
    const issue = mapIssue(row);
    if (issue) issues.push(issue);
  }

  const mergeNotes = mapMergeNotes(dto.merge_notes);
  return {
    cartId,
    currency,
    subtotal,
    items,
    bundles,
    issues,
    totals: mapTotals(dto),
    ...(mergeNotes ? { mergeNotes } : {}),
  };
}

export function guestTokenFromPayload(payload: unknown, headerValue: string | null): string | undefined {
  const dto = asRecord(payload);
  const fromBody = typeof dto?.guest_token === 'string' ? dto.guest_token.trim() : '';
  if (fromBody) return fromBody;
  const fromHeader = headerValue?.trim() ?? '';
  return fromHeader || undefined;
}
