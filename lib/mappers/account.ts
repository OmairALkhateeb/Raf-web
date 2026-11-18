import 'server-only';
import { parseLaravelLocation } from '@/lib/account/location';

import type {
  AccountOrder,
  AccountOrderDetail,
  AccountOrderItem,
  AccountOrderItemDetail,
  AccountOrderItemReturn,
  AccountOrderItemReview,
  AccountReturnStatus,
  AccountReviewStatus,
  AccountOrderPaymentSummary,
  AccountOrderRefund,
  AccountOrderShippingAddress,
  AccountOrdersMeta,
  AccountShipment,
  AccountSubOrder,
  Address,
} from '@/types';
import type {
  LaravelCustomerAddressDto,
  LaravelOrderDto,
  LaravelOrderItemDto,
  LaravelOrderStatusDto,
  LaravelPaginatorMetaDto,
} from '@/types/api/account';
import { PLACEHOLDER_MEDIA } from '@/lib/mappers/product';
import { resolveMediaUrl } from '@/lib/api/server/media';

const ORDER_STATUSES: readonly LaravelOrderStatusDto[] = [
  'pending_payment',
  'paid',
  'processing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'failed',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return value === 1;
  return undefined;
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

function nonNegativeInt(value: unknown): number | undefined {
  const n = finiteNumber(value);
  if (n === undefined || !Number.isInteger(n) || n < 0) return undefined;
  return n;
}

function pageNumber(value: unknown): number | undefined {
  const n = nonNegativeInt(value);
  if (n === undefined) return undefined;
  return n < 1 ? 1 : n;
}

export function unwrapLaravelData(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record) return payload;
  if ('data' in record) return record.data;
  return payload;
}

export function parseLaravelAddress(
  raw: unknown,
): LaravelCustomerAddressDto | undefined {
  const dto = asRecord(raw);
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const name = asNonEmptyString(dto.name);
  const phone = asNonEmptyString(dto.phone);
  const city = asNonEmptyString(dto.city);
  const addressLine1 = asNonEmptyString(dto.address_line1);

  if (id === undefined || !name || !phone || !city || !addressLine1) {
    return undefined;
  }

  const country =
    dto.country === undefined ? null : asNullableString(dto.country);
  const label = asNullableString(dto.label);
  const area = asNullableString(dto.area);
  const addressLine2 = asNullableString(dto.address_line2);
  const postalCode = asNullableString(dto.postal_code);
  if (
    country === undefined ||
    label === undefined ||
    area === undefined ||
    addressLine2 === undefined ||
    postalCode === undefined
  ) {
    return undefined;
  }

  const isDefault = asBoolean(dto.is_default);
  if (isDefault === undefined) return undefined;

  return {
    id,
    label,
    name,
    phone,
    country,
    city,
    area,
    address_line1: addressLine1,
    address_line2: addressLine2,
    postal_code: postalCode,
    is_default: isDefault,
    latitude: dto.latitude === undefined ? null : (dto.latitude as string | number | null),
    longitude: dto.longitude === undefined ? null : (dto.longitude as string | number | null),
  };
}

export function toAddress(dto: LaravelCustomerAddressDto): Address {
  return {
    id: String(dto.id),
    label: dto.label,
    fullName: dto.name,
    phone: dto.phone,
    street: dto.address_line1,
    addressLine2: dto.address_line2,
    city: dto.city,
    area: dto.area,
    postalCode: dto.postal_code,
    country: dto.country,
    isDefault: dto.is_default,
    location: parseLaravelLocation(dto.latitude, dto.longitude),
  };
}

export function parseLaravelAddressList(raw: unknown): Address[] | undefined {
  const data = unwrapLaravelData(raw);
  if (!Array.isArray(data)) return undefined;

  const addresses: Address[] = [];
  for (const entry of data) {
    const dto = parseLaravelAddress(entry);
    if (!dto) {
      console.error('Laravel address row could not be mapped');
      continue;
    }
    addresses.push(toAddress(dto));
  }
  return addresses;
}

export function parseLaravelAddressResource(raw: unknown): Address | undefined {
  const dto = parseLaravelAddress(unwrapLaravelData(raw));
  return dto ? toAddress(dto) : undefined;
}

function isOrderStatus(value: unknown): value is LaravelOrderStatusDto {
  return (
    typeof value === 'string' &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

const RETURN_STATUSES: readonly AccountReturnStatus[] = [
  'pending',
  'approved',
  'rejected',
  'completed',
  'cancelled',
];

const REVIEW_STATUSES: readonly AccountReviewStatus[] = [
  'pending',
  'approved',
  'rejected',
  'hidden',
];

function nullableMoney(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return finiteNumber(value);
}

/** `undefined` = malformed; `null` = no return yet. */
function parseItemReturn(
  raw: unknown,
): AccountOrderItemReturn | null | undefined {
  if (raw === null || raw === undefined) return null;
  const dto = asRecord(raw);
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const quantity = positiveInt(dto.quantity);
  const reason = asNonEmptyString(dto.reason);
  const status = dto.status;
  if (
    id === undefined ||
    quantity === undefined ||
    !reason ||
    typeof status !== 'string' ||
    !(RETURN_STATUSES as readonly string[]).includes(status)
  ) {
    return undefined;
  }

  const refundAmount = nullableMoney(dto.refund_amount);
  const merchantNote = asNullableString(dto.merchant_note ?? null);
  if (refundAmount === undefined || merchantNote === undefined) return undefined;

  return {
    id,
    quantity,
    reason,
    reasonLabel: asNonEmptyString(dto.reason_label) ?? reason,
    reasonLabelAr: asNonEmptyString(dto.reason_label_ar) ?? null,
    status: status as AccountReturnStatus,
    refundAmount,
    refundStatus:
      dto.refund_status === 'succeeded' ||
      dto.refund_status === 'failed' ||
      dto.refund_status === 'pending' ||
      dto.refund_status === 'awaiting_transfer'
        ? dto.refund_status
        : null,
    merchantNote,
  };
}

/** `undefined` = malformed; `null` = not reviewed. */
function parseItemReview(
  raw: unknown,
): AccountOrderItemReview | null | undefined {
  if (raw === null || raw === undefined) return null;
  const dto = asRecord(raw);
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const rating = positiveInt(dto.rating);
  const status = dto.status;
  if (
    id === undefined ||
    rating === undefined ||
    rating > 5 ||
    typeof status !== 'string' ||
    !(REVIEW_STATUSES as readonly string[]).includes(status)
  ) {
    return undefined;
  }

  const comment = asNullableString(dto.comment ?? null);
  const merchantReply = asNullableString(dto.merchant_reply ?? null);
  if (comment === undefined || merchantReply === undefined) return undefined;

  return {
    id,
    rating,
    comment,
    status: status as AccountReviewStatus,
    merchantReply,
  };
}

function parseOrderItem(raw: unknown): AccountOrderItem | undefined {
  const dto = asRecord(raw) as LaravelOrderItemDto | null;
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const productId = positiveInt(dto.product_id);
  const productName = asNonEmptyString(dto.product_name);
  if (id === undefined || productId === undefined || !productName)
    return undefined;

  const imageUrl =
    resolveMediaUrl(typeof dto.image_url === 'string' ? dto.image_url : null) ??
    PLACEHOLDER_MEDIA;

  // A malformed nested return/review shouldn't hide the whole line; drop it.
  const returnRequest = parseItemReturn(dto.return_request);
  const review = parseItemReview(dto.review);
  if (returnRequest === undefined) {
    console.error('Laravel order item return_request could not be mapped');
  }
  if (review === undefined) {
    console.error('Laravel order item review could not be mapped');
  }

  const returnWindowEndsAt =
    typeof dto.return_window_ends_at === 'string' &&
    dto.return_window_ends_at.trim()
      ? dto.return_window_ends_at
      : null;

  return {
    id,
    productId,
    productName,
    productNameAr: asNonEmptyString(dto.product_name_ar) ?? null,
    imageUrl,
    canReturn: dto.can_return === true,
    returnableQuantity: nonNegativeInt(dto.returnable_quantity) ?? 0,
    returnWindowEndsAt,
    canReview: dto.can_review === true,
    returnRequest: returnRequest ?? null,
    review: review ?? null,
  };
}

function parseOptionMap(
  value: unknown,
): Record<string, string> | null | undefined {
  if (value === null) return null;
  if (value === undefined) return null;
  const record = asRecord(value);
  if (!record) return undefined;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(record)) {
    const k = key.trim();
    if (!k) continue;
    if (typeof raw === 'string' || typeof raw === 'number') {
      const s = String(raw).trim();
      if (s) out[k] = s;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parseOrderItemDetail(raw: unknown): AccountOrderItemDetail | undefined {
  const base = parseOrderItem(raw);
  if (!base) return undefined;
  const dto = asRecord(raw);
  if (!dto) return undefined;

  const variantId =
    dto.variant_id === null || dto.variant_id === undefined
      ? null
      : positiveInt(dto.variant_id);
  if (variantId === undefined) return undefined;

  const productBundleId =
    dto.product_bundle_id === null || dto.product_bundle_id === undefined
      ? null
      : (positiveInt(dto.product_bundle_id) ?? null);

  const brandName = asNullableString(dto.brand_name);
  const categoryName = asNullableString(dto.category_name);
  const sku = asNullableString(dto.sku);
  if (
    brandName === undefined ||
    categoryName === undefined ||
    sku === undefined
  ) {
    return undefined;
  }

  const options = parseOptionMap(dto.options);
  if (options === undefined) return undefined;

  const unitPrice = finiteNumber(dto.unit_price);
  const quantity = positiveInt(dto.quantity);
  const discountTotal = finiteNumber(dto.discount_total) ?? 0;
  const taxTotal = finiteNumber(dto.tax_total) ?? 0;
  const total = finiteNumber(dto.total);
  if (
    unitPrice === undefined ||
    quantity === undefined ||
    total === undefined
  ) {
    return undefined;
  }

  let salePrice: number | null = null;
  if (dto.sale_price !== null && dto.sale_price !== undefined) {
    const n = finiteNumber(dto.sale_price);
    if (n === undefined) return undefined;
    salePrice = n;
  }

  return {
    ...base,
    variantId,
    productBundleId,
    bundleName: asNonEmptyString(dto.bundle_name) ?? null,
    bundleNameAr: asNonEmptyString(dto.bundle_name_ar) ?? null,
    bundleQuantity:
      productBundleId === null ? null : (positiveInt(dto.bundle_quantity) ?? null),
    brandName,
    brandNameAr: asNonEmptyString(dto.brand_name_ar) ?? null,
    categoryName,
    categoryNameAr: asNonEmptyString(dto.category_name_ar) ?? null,
    sku,
    options,
    unitPrice,
    salePrice,
    quantity,
    discountTotal,
    taxTotal,
    total,
  };
}

function parseShippingAddress(
  raw: unknown,
): AccountOrderShippingAddress | null | undefined {
  if (raw === null) return null;
  const dto = asRecord(raw);
  if (!dto) return undefined;

  const name = asNonEmptyString(dto.name);
  const phone = asNonEmptyString(dto.phone);
  const country = asNonEmptyString(dto.country);
  const city = asNonEmptyString(dto.city);
  const addressLine1 = asNonEmptyString(dto.address_line1);
  if (!name || !phone || !country || !city || !addressLine1) return undefined;

  const area = asNullableString(dto.area);
  const addressLine2 = asNullableString(dto.address_line2);
  const postalCode = asNullableString(dto.postal_code);
  if (
    area === undefined ||
    addressLine2 === undefined ||
    postalCode === undefined
  ) {
    return undefined;
  }

  return {
    name,
    phone,
    country,
    city,
    area,
    addressLine1,
    addressLine2,
    postalCode,
  };
}

function parsePaymentSummary(
  raw: unknown,
): AccountOrderPaymentSummary | null | undefined {
  if (raw === null) return null;
  if (raw === undefined) return null;
  const dto = asRecord(raw);
  if (!dto) return undefined;
  const status = asNonEmptyString(dto.status);
  if (!status) return undefined;
  const provider = asNullableString(dto.provider);
  // Not sent to customers since 08/10/2026 (#17): missing is fine.
  const paymentIntentId =
    dto.payment_intent_id === undefined ? null : asNullableString(dto.payment_intent_id);
  if (provider === undefined || paymentIntentId === undefined) return undefined;
  return {
    status,
    provider,
    paymentIntentId,
    providerLabel: asNullableString(dto.provider_label) ?? null,
    providerLabelAr: asNullableString(dto.provider_label_ar) ?? null,
    redirectUrl: httpsUrl(dto.redirect_url),
  };
}

/**
 * The gateway's pay page is opened as it comes, so keep it only when it is an
 * absolute https link (never `javascript:` or a relative path).
 */
function httpsUrl(value: unknown): string | null {
  const raw = asNonEmptyString(value);
  if (!raw) return null;
  try {
    return new URL(raw).protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
}

function parseRefund(raw: unknown): AccountOrderRefund | undefined {
  const dto = asRecord(raw);
  if (!dto) return undefined;
  const id = positiveInt(dto.id);
  const amount = finiteNumber(dto.amount);
  const status = asNonEmptyString(dto.status);
  const createdAt = asNonEmptyString(dto.created_at);
  if (id === undefined || amount === undefined || !status || !createdAt) return undefined;
  const bankReference = asNonEmptyString(dto.bank_reference) ?? null;
  return {
    id,
    amount,
    currency: asNonEmptyString(dto.currency) ?? 'OMR',
    status,
    // The backend's own rule when `method` is missing: a transfer is waiting or recorded.
    method:
      dto.method === 'bank_transfer' || dto.method === 'original_payment'
        ? dto.method
        : status === 'awaiting_transfer' || bankReference
          ? 'bank_transfer'
          : 'original_payment',
    subOrderId: positiveInt(dto.sub_order_id) ?? null,
    returnRequestId: positiveInt(dto.return_request_id) ?? null,
    bankReference,
    transferredAt: asNonEmptyString(dto.transferred_at) ?? null,
    createdAt,
  };
}

/** Missing `refunds` (list, checkout) is valid and maps to []; bad rows are skipped. */
function parseRefunds(raw: unknown): AccountOrderRefund[] {
  if (!Array.isArray(raw)) return [];
  const refunds: AccountOrderRefund[] = [];
  for (const entry of raw) {
    const refund = parseRefund(entry);
    if (!refund) {
      console.error('Laravel order refund could not be mapped');
      continue;
    }
    refunds.push(refund);
  }
  return refunds;
}

function parseShipment(raw: unknown): AccountShipment | null {
  if (raw === null || raw === undefined) return null;
  const dto = asRecord(raw);
  if (!dto) return null;

  const status = asNonEmptyString(dto.status);
  if (!status) return null;

  const trackingNumber =
    dto.tracking_number === undefined
      ? null
      : asNullableString(dto.tracking_number);
  const courierName =
    dto.courier_name === undefined ? null : asNullableString(dto.courier_name);
  const shippedAt =
    dto.shipped_at === undefined ? null : asNullableString(dto.shipped_at);
  const deliveredAt =
    dto.delivered_at === undefined ? null : asNullableString(dto.delivered_at);
  if (
    trackingNumber === undefined ||
    courierName === undefined ||
    shippedAt === undefined ||
    deliveredAt === undefined
  ) {
    return null;
  }

  return {
    status,
    trackingNumber,
    courierName,
    courierDisplayName: asNullableString(dto.courier_display_name) ?? null,
    courierDisplayNameAr: asNullableString(dto.courier_display_name_ar) ?? null,
    shippedAt,
    deliveredAt,
  };
}

function parseSubOrder(raw: unknown): AccountSubOrder | undefined {
  const dto = asRecord(raw);
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const subOrderNumber = asNonEmptyString(dto.sub_order_number);
  const status = asNonEmptyString(dto.status);
  if (id === undefined || !subOrderNumber || !status) return undefined;

  const merchantName =
    dto.merchant_name === undefined || dto.merchant_name === null
      ? null
      : (asNullableString(dto.merchant_name) ?? null);

  const itemIds = Array.isArray(dto.items)
    ? dto.items
        .map((item) => positiveInt(asRecord(item)?.id))
        .filter((itemId): itemId is number => itemId !== undefined)
    : [];

  return {
    id,
    subOrderNumber,
    merchantName,
    status,
    subtotal: finiteNumber(dto.subtotal) ?? null,
    discountTotal: finiteNumber(dto.discount_total) ?? null,
    shippingTotal: finiteNumber(dto.shipping_total) ?? null,
    taxTotal: finiteNumber(dto.tax_total) ?? null,
    itemIds,
    deliveredAt: asNonEmptyString(dto.delivered_at) ?? null,
    shipment: parseShipment(dto.shipment),
    cancellationReason: asNonEmptyString(dto.cancellation_reason) ?? null,
    refundedTotal: finiteNumber(dto.refunded_total) ?? 0,
  };
}

/**
 * Missing `sub_orders` (relationship not loaded) is valid and maps to [].
 * Malformed rows are skipped so checkout/order mapping still succeeds.
 */
function parseSubOrders(raw: unknown): AccountSubOrder[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return [];

  const subOrders: AccountSubOrder[] = [];
  for (const entry of raw) {
    const mapped = parseSubOrder(entry);
    if (!mapped) {
      console.error('Laravel sub-order could not be mapped');
      continue;
    }
    subOrders.push(mapped);
  }
  return subOrders;
}

function parseOrder(raw: unknown): AccountOrder | undefined {
  const dto = asRecord(raw) as LaravelOrderDto | null;
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const orderNumber = asNonEmptyString(dto.order_number);
  const currency = asNonEmptyString(dto.currency);
  const grandTotal = finiteNumber(dto.grand_total);
  if (id === undefined || !orderNumber || !currency || grandTotal === undefined)
    return undefined;
  if (!isOrderStatus(dto.status)) return undefined;

  const placedAt =
    asNonEmptyString(dto.placed_at) ?? asNonEmptyString(dto.created_at);
  if (!placedAt) return undefined;

  const itemsRaw = Array.isArray(dto.items) ? dto.items : [];
  const items: AccountOrderItem[] = [];
  for (const entry of itemsRaw) {
    const item = parseOrderItem(entry);
    if (!item) {
      console.error('Laravel order item could not be mapped');
      continue;
    }
    items.push(item);
  }

  return {
    id,
    orderNumber,
    status: dto.status,
    paymentStatus: asNonEmptyString(dto.payment_status) ?? null,
    // A malformed payment shouldn't hide the order row.
    payment: parsePaymentSummary(dto.payment) ?? null,
    paymentExpiresAt: asNonEmptyString(dto.payment_expires_at) ?? null,
    placedAt,
    grandTotal,
    currency,
    items,
  };
}

export function parseLaravelOrderDetail(
  raw: unknown,
): AccountOrderDetail | undefined {
  const dto = asRecord(unwrapLaravelData(raw)) as LaravelOrderDto | null;
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const orderNumber = asNonEmptyString(dto.order_number);
  const currency = asNonEmptyString(dto.currency);
  const paymentStatus = asNonEmptyString(dto.payment_status);
  const shippingStatus = asNonEmptyString(dto.shipping_status);
  const subtotal = finiteNumber(dto.subtotal);
  const discountTotal = finiteNumber(dto.discount_total);
  const shippingTotal = finiteNumber(dto.shipping_total);
  const taxTotal = finiteNumber(dto.tax_total);
  const grandTotal = finiteNumber(dto.grand_total);
  if (
    id === undefined ||
    !orderNumber ||
    !currency ||
    !paymentStatus ||
    !shippingStatus ||
    subtotal === undefined ||
    discountTotal === undefined ||
    shippingTotal === undefined ||
    taxTotal === undefined ||
    grandTotal === undefined
  ) {
    return undefined;
  }
  if (!isOrderStatus(dto.status)) return undefined;

  const createdAt = asNonEmptyString(dto.created_at);
  if (!createdAt) return undefined;
  const placedAt = asNonEmptyString(dto.placed_at) ?? createdAt;

  const couponCode = asNullableString(dto.coupon_code);
  if (couponCode === undefined) return undefined;

  const shippingAddress = parseShippingAddress(dto.shipping_address);
  if (shippingAddress === undefined) return undefined;

  const payment = parsePaymentSummary(dto.payment);
  if (payment === undefined) return undefined;

  if (!Array.isArray(dto.items)) return undefined;
  const items: AccountOrderItemDetail[] = [];
  for (const entry of dto.items) {
    const item = parseOrderItemDetail(entry);
    if (!item) {
      console.error('Laravel order detail item could not be mapped');
      return undefined;
    }
    items.push(item);
  }

  return {
    id,
    orderNumber,
    status: dto.status,
    paymentStatus,
    shippingStatus,
    subtotal,
    discountTotal,
    shippingTotal,
    taxTotal,
    grandTotal,
    refundedTotal: finiteNumber(dto.refunded_total) ?? 0,
    currency,
    couponCode,
    shippingAddress,
    payment,
    paymentExpiresAt: asNonEmptyString(dto.payment_expires_at) ?? null,
    refunds: parseRefunds(dto.refunds),
    placedAt,
    createdAt,
    items,
    subOrders: parseSubOrders(dto.sub_orders),
  };
}

export function parseLaravelOrdersPage(
  raw: unknown,
): { orders: AccountOrder[]; meta: AccountOrdersMeta } | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;

  const data = Array.isArray(record.data)
    ? record.data
    : unwrapLaravelData(raw);
  if (!Array.isArray(data)) return undefined;

  const metaRaw = asRecord(record.meta) as LaravelPaginatorMetaDto | null;
  const currentPage = metaRaw ? pageNumber(metaRaw.current_page) : undefined;
  const lastPage = metaRaw ? pageNumber(metaRaw.last_page) : undefined;
  const perPage = metaRaw ? positiveInt(metaRaw.per_page) : undefined;
  const total = metaRaw ? nonNegativeInt(metaRaw.total) : undefined;
  if (
    currentPage === undefined ||
    lastPage === undefined ||
    perPage === undefined ||
    total === undefined
  ) {
    return undefined;
  }

  const orders: AccountOrder[] = [];
  for (const entry of data) {
    const order = parseOrder(entry);
    if (!order) {
      console.error('Laravel order row could not be mapped');
      continue;
    }
    orders.push(order);
  }

  return {
    orders,
    meta: { currentPage, lastPage, perPage, total },
  };
}
