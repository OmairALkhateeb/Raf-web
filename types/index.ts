/** Dynamic attribute value carried by a product (drives dynamic filtering). */
export type AttributeValue = string | string[] | number | boolean;

export interface Product {
  id: string;
  /** URL-friendly identifier. Optional — routing still works by id. */
  slug?: string;
  name: string;
  /** Absent when the source has no translation — fall back to `name`. */
  nameAr?: string;
  brand: string;
  /** Absent when the source has no translation — fall back to `brand`. */
  brandAr?: string;
  brandId: string;
  /** URL-friendly brand identifier. Prefer this over `brandId` when linking. */
  brandSlug?: string;
  category: string;
  /** Absent when the source has no translation — fall back to `category`. */
  categoryAr?: string;
  categoryId: string;
  /** Sub-category this product belongs to (navigation, not a filter). */
  subCategoryId?: string;
  /** Dynamic attributes (skin_type, hair_type, gender, size, usage, …). Source of dynamic filtering. */
  attributes?: Record<string, AttributeValue>;
  price: number;
  originalPrice?: number;
  currency: string;
  rating: number;
  reviewCount: number;
  images: string[];
  description: string;
  /** Absent when the source has no translation — fall back to `description`. */
  descriptionAr?: string;
  specifications: Specification[];
  tags: string[];
  inStock: boolean;
  /** Still sold, but at or below the merchant's low-stock threshold. */
  lowStock?: boolean;
  /** Absent when the source exposes no quantity. */
  stockCount?: number;
  isNew?: boolean;
  isFeatured?: boolean;
  isBestseller?: boolean;
  discount?: number;
  colors?: string[];
  sizes?: string[];
  /** True when the product requires a variant selection before add-to-cart. */
  hasVariants?: boolean;
  /**
   * Wishlist only: the product is no longer sold (archived, rejected, hidden…).
   * Its page 404s and it can't be added to the cart.
   */
  unavailable?: boolean;
}

/** Resolved gallery frame. `url` is already a `next/image`-safe value. */
export interface ProductGalleryImage {
  url: string;
  alt: string | null;
}

export interface ProductDetailAttribute {
  code: string;
  name: string;
  value: string;
  nameAr: string | null;
  valueAr: string | null;
}

/**
 * One selectable variant card. Identity is always `id` (never an array index).
 * `images` is empty when the variant has no resolvable media — keep the parent gallery.
 */
export interface ProductDetailVariant {
  id: number;
  sku: string;
  barcode: string | null;
  label: string;
  /** Arabic option text, when the merchant translated it. */
  labelAr: string | null;
  price: number;
  originalPrice?: number;
  images: ProductGalleryImage[];
  quantityAvailable?: number;
  isAvailable: boolean;
  isLowStock: boolean;
  sortOrder: number;
}

export interface ProductDetailReview {
  id: number;
  customerName: string | null;
  rating: number;
  comment: string | null;
  merchantReply: string | null;
  merchantRepliedAt: string | null;
  createdAt: string;
}

export interface ProductDetailSpecification {
  key: string;
  value: string;
}

export interface ProductDetail {
  listing: Product;
  slug: string;
  name: string;
  nameAr: string | null;
  brand: string;
  brandAr: string | null;
  brandSlug: string;
  category: string;
  categoryAr: string | null;
  categorySlug: string;
  /** Set when the product's category is a sub-category: its parent, for the breadcrumb. */
  categoryParent?: { slug: string; name: string; nameAr: string | null };
  merchantName?: string;
  /** Path segment for `/sellers/{…}`: the merchant's slug, or its id when the slug is missing. */
  merchantSlug?: string;
  merchantLogo?: string;
  shortDescription: string | null;
  shortDescriptionAr: string | null;
  /** Plain text; render with line breaks, never as HTML. */
  description: string | null;
  descriptionAr: string | null;
  specifications: ProductDetailSpecification[];
  /** The Arabic list, shown instead in Arabic when not empty. */
  specificationsAr: ProductDetailSpecification[];
  tags: string[];
  /** Simple products only; `undefined` when the backend doesn't say. */
  availableQuantity?: number;
  reviews: ProductDetailReview[];
  price: number;
  originalPrice?: number;
  discount?: number;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  lowStock?: boolean;
  hasVariants: boolean;
  images: ProductGalleryImage[];
  /** Set only when a Laravel /storage (or absolute) image resolved. Never the local placeholder. */
  openGraphImageUrl?: string;
  attributes: ProductDetailAttribute[];
  variants: ProductDetailVariant[];
}

export interface Specification {
  key: string;
  keyAr: string;
  value: string;
  valueAr: string;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified: boolean;
  helpful: number;
}

export interface Brand {
  id: string;
  /** URL-friendly identifier used in `/brands/{slug}` and `/products?brand={slug}`. */
  slug: string;
  name: string;
  /** Absent when the source has no translation — fall back to `name`. */
  nameAr?: string;
  /** Absent when no logo artwork exists. */
  logo?: string;
  /** Wide cover image shown on the brand mini-store page. */
  banner?: string;
  /** Short marketing line under the brand name. */
  tagline?: string;
  taglineAr?: string;
  description: string;
  /** Absent when the source has no translation — fall back to `description`. */
  descriptionAr?: string;
  origin: string;
  featured: boolean;
  productCount: number;
  /** Slugs of the categories it sells in (parents included); absent when unknown. */
  categorySlugs?: string[];
  /** Optional brand accent colour for light theming on the mini-store. */
  accentColor?: string;
}

/** A category tab on a seller's store page. */
export interface SellerStoreCategory {
  id: number;
  slug: string;
  name: string;
  nameAr?: string;
  parentId: number | null;
}

/** A merchant's public store (`/sellers/{slug}`), mapped from `PublicMerchantDto`. */
export interface SellerStore {
  id: string;
  slug: string;
  name: string;
  logo?: string;
  /** Trimmed; `undefined` when empty. One language only. */
  description?: string;
  city?: string;
  productCount: number;
  /** 0 when there are no approved reviews. */
  rating: number;
  reviewCount: number;
  /** ISO 8601, or `undefined` when the backend sent none. */
  joinedAt?: string;
  categories: SellerStoreCategory[];
}

/** A sub-category belongs to a Category. Selecting one navigates to its products — it is NOT a filter. */
export interface SubCategory {
  id: string;
  slug: string;
  name: string;
  /** Absent when the source has no translation — fall back to `name`. */
  nameAr?: string;
  categoryId: string;
  image?: string;
  productCount: number;
}

export interface Category {
  id: string;
  /** URL-friendly identifier used in `/products?category={slug}`. */
  slug: string;
  name: string;
  /** Absent when the source has no translation — fall back to `name`. */
  nameAr?: string;
  image: string;
  icon: string;
  /** Absent when the source does not expose a count. */
  productCount?: number;
  featured: boolean;
  subCategories?: SubCategory[];
}

/* ── Dynamic filters (delivered per sub-category by the backend) ── */

export type FilterType =
  'select' | 'multi_select' | 'range' | 'boolean' | 'number';

export interface FilterValue {
  value: string;
  label: string;
  labelAr: string;
  count?: number;
}

export interface ProductFilter {
  /** Query-param key, e.g. `skin_type`. */
  key: string;
  label: string;
  labelAr: string;
  type: FilterType;
  /** Present for select / multi_select. */
  values?: FilterValue[];
  /** Present for range / number. */
  min?: number;
  max?: number;
  unit?: string;
}

/* ── Banners (admin-managed, clickable, route to related products) ── */

export type BannerPlacement =
  | 'home_hero'
  | 'home_middle'
  | 'home_bottom'
  | 'category_page'
  | 'brand_page'
  | 'promotion'
  | 'footer';

export type BannerLinkType =
  | 'category'
  | 'brand'
  | 'product'
  | 'product_listing'
  | 'search'
  | 'custom_url';

export interface BannerTarget {
  categorySlug?: string;
  brandSlug?: string;
  productSlug?: string;
  /** For product_listing: filters compiled into query params. */
  filters?: Record<string, string | number>;
  /** For product_listing/custom_url: an explicit (relative) URL. */
  url?: string;
  /** For search. */
  searchQuery?: string;
}

export interface Banner {
  id: string;
  placement: BannerPlacement;
  title: string;
  /** Absent when the source has no translation — fall back to `title`. */
  titleAr?: string;
  subtitle: string;
  /** Absent when the source has no translation — fall back to `subtitle`. */
  subtitleAr?: string;
  buttonText: string;
  buttonTextAr?: string;
  imageDesktop: string;
  imageMobile: string;
  linkType: BannerLinkType;
  target: BannerTarget;
  bgColor?: string;
  textColor?: string;
  /**
   * Banners from GET /public/banners: the link already resolved on the server.
   * `null` = not clickable. Same-site URLs are paths; others are external.
   */
  href?: string | null;
  external?: boolean;
  /** Offer text under the subtitle, when the admin wrote one. */
  description?: string;
  descriptionAr?: string;
  /** When the offer ends (ISO), for "Ends {date}". */
  endsAt?: string;
}

/* ── Product query contract (shared by mock + real API) ── */

export interface ProductQuery {
  category?: string;
  subCategory?: string;
  brands?: string[];
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  search?: string;
  hasDiscount?: boolean;
  sort?: SortOption;
  /** Dynamic select / multi_select / boolean filters keyed by ProductFilter.key. */
  attributes?: Record<string, string[]>;
  /** Dynamic range / number filters keyed by ProductFilter.key (e.g. `size`). */
  ranges?: Record<string, { min?: number; max?: number }>;
}

export interface CartItem {
  itemId: number;
  productId: number;
  variantId: number | null;
  name: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  availableStock: number;
  /** Arabic product name; `null` when the merchant hasn't written one. */
  nameAr: string | null;
  /** Product page slug, when the backend sends it (backend note 39). */
  slug: string | null;
  variantSku: string | null;
  /** The chosen option, e.g. `{ Size: '100ml' }`; `null` without a variant. */
  options: Record<string, string> | null;
}

export type CartIssueReason = 'unavailable' | 'stock' | 'unknown';

/** A problem with one cart line: a product line (`itemId`) or a bundle line. */
export interface CartIssue {
  itemId: number | null;
  bundleItemId: number | null;
  reason: CartIssueReason;
  /** Units left, for stock issues; `null` when unknown. */
  available: number | null;
}

/** One product inside a cart bundle line. */
export interface CartBundleContent {
  productId: number;
  name: string;
  nameAr: string | null;
  variantId: number | null;
  /** The included option ("50 ml"), when the bundle fixes a variant. */
  variantLabel: string | null;
  variantLabelAr: string | null;
  quantity: number;
}

/** A guest-cart line the login merge dropped or reduced (backend #30). */
export interface CartMergeNote {
  name: string;
  nameAr: string | null;
  code: 'dropped' | 'capped';
  requested: number | null;
  merged: number | null;
}

/** A bundle in the cart (`bundles[]`); its price is already in the subtotal. */
export interface CartBundleLine {
  bundleItemId: number;
  bundleId: number;
  name: string;
  nameAr: string | null;
  slug: string;
  imageUrl: string;
  unitPrice: number;
  comparePrice: number | null;
  quantity: number;
  lineTotal: number;
  contents: CartBundleContent[];
}

/** The cart's totals, computed by the backend exactly as checkout will. */
export interface CartTotals {
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  /** Percent; 0 when tax is off. */
  taxRate: number;
  grandTotal: number;
  freeShippingThreshold: number | null;
  /** No address yet, so shipping is an estimate. */
  shippingEstimated: boolean;
  /**
   * `false`: we don't deliver to this address with this method, so checkout
   * will refuse it and a `shippingTotal` of 0 is NOT free shipping.
   * `null`: unknown (estimated, or an older API).
   */
  shippingAvailable: boolean | null;
  shippingAddressId: number | null;
  shippingMethodId: number | null;
}

export interface CartSnapshot {
  cartId: number;
  currency: string;
  /** Includes bundle lines. */
  subtotal: number;
  items: CartItem[];
  bundles: CartBundleLine[];
  issues: CartIssue[];
  /** `null` when the backend sends no totals (older API). */
  totals: CartTotals | null;
  /** Only on the login merge; `undefined` on other responses. */
  mergeNotes?: CartMergeNote[];
}

/** Mock account-order line. Distinct from Laravel guest-cart `CartItem`. */
export interface OrderLine {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  date: string;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderLine[];
  total: number;
  trackingNumber?: string;
}

export type AccountOrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed';

/** Latest return request on an order line (OrderItemResource `return_request`). */
export interface AccountOrderItemReturn {
  id: number;
  quantity: number;
  reason: string;
  reasonLabel: string;
  reasonLabelAr: string | null;
  status: AccountReturnStatus;
  refundAmount: number | null;
  refundStatus: AccountRefundStatus | null;
  merchantNote: string | null;
}

/** The customer's review of an order line (OrderItemResource `review`). */
export interface AccountOrderItemReview {
  id: number;
  rating: number;
  comment: string | null;
  status: AccountReviewStatus;
  merchantReply: string | null;
}

/** Live order line from GET /api/customer/orders. Not a catalog Product. */
export interface AccountOrderItem {
  id: number;
  productId: number;
  productName: string;
  /** Arabic name frozen at purchase; `null` when there was none. */
  productNameAr: string | null;
  imageUrl: string;
  /**
   * Return/review eligibility is computed by the backend per line. When the
   * backend omits it (relations not loaded) both flags are false.
   */
  canReturn: boolean;
  returnableQuantity: number;
  returnWindowEndsAt: string | null;
  canReview: boolean;
  returnRequest: AccountOrderItemReturn | null;
  review: AccountOrderItemReview | null;
}

export interface AccountOrder {
  id: number;
  orderNumber: string;
  status: AccountOrderStatus;
  /** `pending` | `paid` | `failed`; `null` if the backend left it out. */
  paymentStatus: string | null;
  /** The latest payment attempt (in the list since 11/10/2026). */
  payment: AccountOrderPaymentSummary | null;
  /** Until when an unpaid order can still be paid (UTC); `null` once it isn't waiting. */
  paymentExpiresAt: string | null;
  placedAt: string;
  grandTotal: number;
  currency: string;
  items: AccountOrderItem[];
}

export interface AccountOrdersMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export type AccountReturnStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

/**
 * Money going back for a completed return: `succeeded` (refunded),
 * `failed` (the gateway failed; the admin retries), `pending`, or
 * `awaiting_transfer` (RAF sends it to the customer's IBAN; Thawani only
 * refunds whole payments). `null` = not completed yet / nothing to refund.
 */
export type AccountRefundStatus = 'succeeded' | 'failed' | 'pending' | 'awaiting_transfer';

export interface AccountReturnOrderItem {
  id: number;
  productId: number | null;
  productName: string;
  productNameAr: string | null;
  bundleName: string | null;
  bundleNameAr: string | null;
  imageUrl: string | null;
  sku: string | null;
  orderedQuantity: number;
}

export interface AccountReturnRequest {
  id: number;
  subOrderId: number;
  subOrderNumber: string | null;
  orderItem: AccountReturnOrderItem | null;
  quantity: number;
  /** Reason code (`damaged`, `other`, …); show `reasonLabel` / `reasonLabelAr`. */
  reason: string;
  reasonLabel: string;
  reasonLabelAr: string | null;
  note: string | null;
  status: AccountReturnStatus;
  refundAmount: number | null;
  refundStatus: AccountRefundStatus | null;
  merchantNote: string | null;
  resolvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** One option from GET /customer/returns/reasons. */
export interface AccountReturnReason {
  code: string;
  label: string;
  labelAr: string | null;
  requiresNote: boolean;
}

export interface AccountReturnReasons {
  reasons: AccountReturnReason[];
  /** Admin setting; 0 means no time limit. */
  returnWindowDays: number;
}

export interface AccountReturnsMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export type AccountReviewStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'hidden';

/** Live review from GET/POST /api/customer/reviews (authenticated customer only). */
export interface AccountReview {
  id: number;
  productId: number;
  productName: string | null;
  productNameAr: string | null;
  /** For a link to the product page; `null` when not sent. */
  productSlug: string | null;
  productImageUrl: string;
  customerName: string | null;
  rating: number;
  comment: string | null;
  status: AccountReviewStatus;
  merchantReply: string | null;
  merchantRepliedAt: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface AccountReviewsMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export type AccountProductQuestionStatus =
  | 'pending'
  | 'answered'
  | 'hidden';

/**
 * Live row from GET/POST /api/customer/product-questions
 * (authenticated customer’s questions only — not a public Q&A feed).
 */
export interface AccountProductQuestion {
  id: number;
  productId: number;
  /** Present when Laravel eager-loads `product` (customer index does). */
  productName: string | null;
  customerName: string | null;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  status: AccountProductQuestionStatus;
  createdAt: string;
}

export interface AccountProductQuestionsMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export type AccountBulkOrderStatus =
  | 'pending'
  | 'quoted'
  | 'accepted'
  | 'rejected'
  | 'cancelled';

/**
 * Live row from customer bulk-order-request endpoints
 * (authenticated customer’s requests only).
 */
export interface AccountBulkOrderRequest {
  id: number;
  productId: number;
  productName: string | null;
  productNameAr: string | null;
  variantId: number | null;
  customerName: string | null;
  quantity: number;
  note: string | null;
  status: AccountBulkOrderStatus;
  quotedUnitPrice: string | null;
  quotedNote: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface AccountBulkOrderRequestsMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

/** Shipping address snapshot from OrderResource `shipping_address`. */
export interface AccountOrderShippingAddress {
  name: string;
  phone: string;
  country: string;
  city: string;
  area: string | null;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string | null;
}

/** Line item from GET /api/customer/orders/{id} (OrderItemResource). */
export interface AccountOrderItemDetail extends AccountOrderItem {
  variantId: number | null;
  /** Set on lines bought as part of a bundle. */
  productBundleId: number | null;
  bundleName: string | null;
  bundleNameAr: string | null;
  /** How many bundles were bought; null on other lines and on orders before 14/10. */
  bundleQuantity: number | null;
  brandName: string | null;
  brandNameAr: string | null;
  categoryName: string | null;
  categoryNameAr: string | null;
  sku: string | null;
  options: Record<string, string> | null;
  unitPrice: number;
  salePrice: number | null;
  quantity: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

export interface AccountOrderPaymentSummary {
  status: string;
  provider: string | null;
  /** No longer sent to customers (backend #17); kept for older payloads. */
  paymentIntentId: string | null;
  /** The backend's display name for `provider`, when sent. */
  providerLabel: string | null;
  providerLabelAr: string | null;
  /**
   * Thawani's pay page, only while `status` is `pending`. Only an absolute
   * `https:` link is kept; open it as it is, in the same tab.
   */
  redirectUrl: string | null;
}

/** Money given back on an order (OrderResource `refunds[]`). */
export interface AccountOrderRefund {
  id: number;
  amount: number;
  currency: string;
  /**
   * `pending` | `succeeded` | `failed` | `awaiting_transfer` (RAF sends it by
   * bank transfer). Kept as sent, so a new value doesn't break the page.
   */
  status: string;
  /** `original_payment` (back to the card) or `bank_transfer`. */
  method: 'original_payment' | 'bank_transfer';
  /** The sub-order a store cancelled, when that's what it refunds. */
  subOrderId: number | null;
  /** The return it refunds. Both ids `null`: a payment that arrived after the order closed. */
  returnRequestId: number | null;
  bankReference: string | null;
  transferredAt: string | null;
  createdAt: string;
}

/**
 * Where RAF sends refunds it can't put back on the card (profile
 * `refund_iban` / `refund_account_name`). Loaded only where it's shown; never
 * kept on the signed-in user or in browser storage.
 */
export interface RefundBankAccount {
  /** Without spaces, upper case (as the backend stores it). */
  iban: string;
  accountName: string;
}

/**
 * Why an account can't be deleted yet (`GET /customer/account/deletion-check`).
 * `other` is a code this store doesn't know yet; it still blocks.
 */
export type AccountDeletionBlockerCode =
  | 'active_orders'
  | 'pending_refunds'
  | 'open_returns'
  | 'other';

export interface AccountDeletionBlocker {
  code: AccountDeletionBlockerCode;
  count: number;
}

/** Shown when the "Delete my account" dialog opens, before the password is asked. */
export interface AccountDeletionCheck {
  /** `false` whenever `blockers` isn't empty. */
  canDelete: boolean;
  blockers: AccountDeletionBlocker[];
  /** Unpaid orders the backend cancels on the way. */
  unpaidOrdersToCancel: number;
}

/** Customer-visible shipment on a sub-order. `null` before courier booking. */
export interface AccountShipment {
  status: string;
  trackingNumber: string | null;
  courierName: string | null;
  /** The backend's display name for `courierName`, when sent. */
  courierDisplayName: string | null;
  courierDisplayNameAr: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

/** Customer-visible sub-order from OrderResource `sub_orders`. */
export interface AccountSubOrder {
  id: number;
  subOrderNumber: string;
  merchantName: string | null;
  status: string;
  /** This merchant's part of the order; `null` if the backend omitted it. */
  subtotal: number | null;
  discountTotal: number | null;
  shippingTotal: number | null;
  taxTotal: number | null;
  /** Order-item ids in this sub-order. */
  itemIds: number[];
  deliveredAt: string | null;
  shipment: AccountShipment | null;
  /** Why this part was cancelled, when it was. */
  cancellationReason: string | null;
  /** Refunded for this part (0 when nothing). */
  refundedTotal: number;
}

/** Full order from GET /api/customer/orders/{id} (OrderResource). */
export interface AccountOrderDetail {
  id: number;
  orderNumber: string;
  status: AccountOrderStatus;
  paymentStatus: string;
  shippingStatus: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
  /** Already refunded to the customer; 0 when nothing was refunded. */
  refundedTotal: number;
  currency: string;
  couponCode: string | null;
  shippingAddress: AccountOrderShippingAddress | null;
  payment: AccountOrderPaymentSummary | null;
  /** Until when an unpaid order can still be paid (UTC); `null` once it isn't waiting. */
  paymentExpiresAt: string | null;
  /** Refunds on this order; empty when none (and in the checkout answer). */
  refunds: AccountOrderRefund[];
  placedAt: string;
  createdAt: string;
  items: AccountOrderItemDetail[];
  /** Empty when Laravel omitted `sub_orders` or none were mappable. */
  subOrders: AccountSubOrder[];
}

/** One product in a bundle (`ProductBundleResource.items[]`). */
export interface BundleItemView {
  id: number;
  productName: string;
  productNameAr: string | null;
  productSlug: string | null;
  imageUrl: string;
  variantId: number | null;
  /** The included option ("50 ml"), when the bundle fixes a variant. */
  variantLabel: string | null;
  variantLabelAr: string | null;
  quantity: number;
  unitPrice: number | null;
}

/** A bundle / gift set from GET /public/bundles (or the home payload). */
export interface BundleView {
  id: number;
  slug: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  bundlePrice: number;
  comparePrice: number | null;
  savings: number | null;
  isGiftSet: boolean;
  imageUrl: string;
  inStock: boolean;
  items: BundleItemView[];
}

export type NotificationCategory =
  | 'orders'
  | 'shipping'
  | 'returns'
  | 'community'
  | 'announcements'
  | 'other';

export interface NotificationText {
  title: string | null;
  body: string | null;
}

/** Where tapping a notification goes (`order`, `return`, `product`…). */
export interface NotificationTarget {
  type: string;
  id: number | null;
  /** Products only. */
  slug: string | null;
}

/** One inbox entry from GET /customer/notifications. */
export interface CustomerNotification {
  id: string;
  type: string;
  category: NotificationCategory;
  /** In the language the request asked for; may be `null` on old rows. */
  title: string | null;
  body: string | null;
  /** Both languages, so the UI can switch without a new request. */
  translations: { en: NotificationText | null; ar: NotificationText | null };
  target: NotificationTarget | null;
  /**
   * Which case of the type it is (`refund_status`: `awaiting_transfer`,
   * `bank_details_needed`, `transferred`, `late_payment_refunded`;
   * `order_cancelled`: `refunded`, `refund_by_transfer`, …). `null` when none.
   */
  variant: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsPage {
  notifications: CustomerNotification[];
  currentPage: number;
  lastPage: number;
  total: number;
}

export interface NotificationUnread {
  unreadCount: number;
  byCategory: Partial<Record<NotificationCategory, number>>;
}

export interface NotificationPreference {
  category: NotificationCategory;
  label: { en: string; ar: string };
  /** When true the switches can't be turned off. */
  mandatory: boolean;
  push: boolean;
  mail: boolean;
}

export interface NotificationPreferences {
  locale: 'en' | 'ar';
  items: NotificationPreference[];
}

/** One option from GET /customer/shipping-methods for the chosen address. */
export interface ShippingMethodOption {
  id: number;
  code: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  /** Fee for this cart and address (0 = free); `null` when the method isn't available. */
  price: number | null;
  /** The zone's fee before any free-shipping rule; `null` without a zone. */
  baseFee: number | null;
  /** Free above this cart amount; `null` when the method has no threshold. */
  freeShippingThreshold: number | null;
  durationHours: number | null;
  preparationHours: number | null;
  /** The address's city is one we deliver to (not enough on its own). */
  zoneAvailable: boolean;
  /**
   * This method is offered for this address (15/10/2026). A zone may not offer
   * every method; checkout refuses one it doesn't. Use this, not `zoneAvailable`.
   */
  available: boolean;
}

/** POST /customer/checkout/coupon-preview: the totals the order will have. */
export interface CouponPreview {
  couponCode: string;
  couponType: string | null;
  freeShipping: boolean;
  subtotal: number;
  discountTotal: number;
  /** `null` until both the address and the shipping method are sent. */
  shippingTotal: number | null;
  /** Same meaning as `CartTotals.shippingAvailable`. */
  shippingAvailable: boolean | null;
  taxTotal: number | null;
  grandTotal: number | null;
}

export interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  street: string;
  addressLine2: string | null;
  city: string;
  area: string | null;
  postalCode: string | null;
  country: string | null;
  isDefault: boolean;
  /** Optional delivery pin. */
  location: { latitude: number; longitude: number } | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** From Laravel UserResource `email_verified`. */
  emailVerified: boolean;
  /** From Laravel UserResource `phone_verified`. */
  phoneVerified: boolean;
  /** Absent when the backend has no avatar artwork. */
  avatar?: string;
  gender?: 'male' | 'female' | 'unspecified';
  /** `YYYY-MM-DD`, or `null` when not set. */
  dateOfBirth?: string | null;
  addresses: Address[];
  orders: Order[];
}

export type Language = 'en' | 'ar';
export type SortOption =
  'popular' | 'newest' | 'price-asc' | 'price-desc' | 'rating';
