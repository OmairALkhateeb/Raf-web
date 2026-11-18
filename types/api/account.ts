import type {
  AccountBulkOrderRequest,
  AccountDeletionBlocker,
  AccountDeletionCheck,
  AccountBulkOrderRequestsMeta,
  AccountOrder,
  AccountOrderDetail,
  AccountOrdersMeta,
  AccountProductQuestion,
  AccountProductQuestionsMeta,
  AccountReturnReasons,
  AccountReturnRequest,
  CouponPreview,
  RefundBankAccount,
  ShippingMethodOption,
  AccountReturnsMeta,
  AccountReview,
  AccountReviewsMeta,
  Address,
  User,
} from '@/types';

/**
 * Transport types for Laravel customer address and order resources.
 * Tokens stay on the server BFF — these Laravel DTOs are not returned to the browser.
 */

export interface LaravelCustomerAddressDto {
  id: number;
  label: string | null;
  name: string;
  phone: string;
  country: string | null;
  city: string;
  area: string | null;
  address_line1: string;
  address_line2: string | null;
  postal_code: string | null;
  is_default: boolean;
  /** Decimal strings (`"23.6000000"`) or null. */
  latitude: string | number | null;
  longitude: string | number | null;
}

export type LaravelOrderStatusDto =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export interface LaravelOrderItemDto {
  id: number;
  product_id: number;
  variant_id: number | null;
  /** Lines bought as one bundle share this id (and the bundle's name). */
  product_bundle_id?: number | null;
  bundle_name?: string | null;
  bundle_name_ar?: string | null;
  /** How many bundles were bought (the line's quantity = units per bundle × this). Null before 14/10. */
  bundle_quantity?: number | null;
  product_name: string;
  product_name_ar?: string | null;
  brand_name: string | null;
  category_name: string | null;
  /** Since 08/10/2026 (#25). */
  brand_name_ar?: string | null;
  category_name_ar?: string | null;
  sku: string | null;
  image_url: string | null;
  options: Record<string, unknown> | null;
  unit_price: string;
  sale_price: string | null;
  quantity: number;
  discount_total?: string;
  tax_total?: string;
  total: string;
  /**
   * Present on the customer's own order endpoints, which load the review and
   * return relations. The backend computes the eligibility; don't re-derive it.
   */
  can_return?: boolean;
  returnable_quantity?: number;
  return_window_ends_at?: string | null;
  can_review?: boolean;
  /** Latest return request for this line, any status. */
  return_request?: LaravelOrderItemReturnDto | null;
  /** Every return request for this line, newest first (unused: the latest is enough). */
  return_requests?: LaravelOrderItemReturnDto[];
  review?: LaravelOrderItemReviewDto | null;
}

export interface LaravelOrderItemReturnDto {
  id: number;
  quantity: number;
  reason: string;
  reason_label: string;
  reason_label_ar: string | null;
  note: string | null;
  status: LaravelReturnStatusDto;
  refund_amount: string | null;
  refund_status: string | null;
  merchant_note: string | null;
  /** Sent but unused by the store. */
  resolved_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface LaravelOrderItemReviewDto {
  id: number;
  rating: number;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  merchant_reply: string | null;
  /** Sent but unused by the store. */
  product_id?: number;
  merchant_replied_at?: string | null;
  verified_purchase?: boolean;
  created_at?: string;
}

/** GET /customer/returns/reasons */
export interface LaravelReturnReasonsDto {
  reasons: Array<{
    code: string;
    label: string;
    label_ar: string | null;
    requires_note: boolean;
  }>;
  return_window_days: number;
}

export interface LaravelOrderPaymentDto {
  status: string;
  provider: string | null;
  /** Admin only since 08/10/2026 (#17); never sent to customers now. */
  payment_intent_id?: string | null;
  /** Display names, e.g. "Test payment" / «دفع تجريبي» for `mock` (#36). */
  provider_label?: string | null;
  provider_label_ar?: string | null;
  /** Thawani's pay page; only set while `status` is `pending` (11/10/2026). */
  redirect_url?: string | null;
}

/** Money given back on an order (OrderResource `refunds[]`, 11/10/2026). */
export interface LaravelOrderRefundDto {
  id: number;
  amount: string;
  currency: string;
  /** `pending` | `succeeded` | `failed` | `awaiting_transfer` (a bank transfer by RAF). */
  status: string;
  /** `original_payment` (back to the card) or `bank_transfer`. */
  method: string;
  /** Set for a sub-order a store cancelled. */
  sub_order_id: number | null;
  /** Set for a return. Both null: a payment that arrived after the order closed. */
  return_request_id: number | null;
  bank_reference: string | null;
  transferred_at: string | null;
  created_at: string;
}

/** Customer-visible shipment on a sub-order. Absent or null before booking. */
export interface LaravelSubOrderShipmentDto {
  status: string;
  tracking_number: string | null;
  courier_name: string | null;
  /** Display names, e.g. "RAF Delivery" / «توصيل رف» for `log` / `manual` (#36). */
  courier_display_name?: string | null;
  courier_display_name_ar?: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}

/**
 * Customer-visible sub-order fields from OrderResource.
 * Merchant-only fields (commission, internal notes, settlement) are omitted.
 */
export interface LaravelSubOrderDto {
  id: number;
  /** Sent but unused by the store. */
  order_id?: number;
  merchant_id?: number;
  created_at?: string;
  sub_order_number: string;
  merchant_name?: string | null;
  status: string;
  subtotal?: string;
  discount_total?: string;
  shipping_total?: string;
  tax_total?: string;
  items?: LaravelOrderItemDto[];
  delivered_at?: string | null;
  shipment?: LaravelSubOrderShipmentDto | null;
  /** The merchant's or admin's note when this part was cancelled (#9). */
  cancellation_reason?: string | null;
  /** Refunded to the customer for this part (returns and, since #32, cancellation). */
  refunded_total?: string;
}

export interface LaravelOrderDto {
  id: number;
  order_number: string;
  status: LaravelOrderStatusDto;
  payment_status: string;
  shipping_status: string;
  subtotal: string;
  discount_total: string;
  shipping_total: string;
  tax_total: string;
  grand_total: string;
  /** Money already refunded to the customer (completed returns). */
  refunded_total?: string;
  currency: string;
  coupon_code: string | null;
  shipping_address: Record<string, unknown> | null;
  /** Omitted when Laravel did not load the `subOrders` relationship. */
  sub_orders?: LaravelSubOrderDto[];
  items: LaravelOrderItemDto[];
  /** The latest payment attempt; in the orders list too since 11/10/2026. */
  payment?: LaravelOrderPaymentDto | null;
  /** Until when an unpaid order can still be paid (UTC); null once it isn't waiting. */
  payment_expires_at?: string | null;
  /** Order page, confirm and retry only (not the list or checkout). */
  refunds?: LaravelOrderRefundDto[];
  placed_at: string | null;
  created_at: string;
}

export interface LaravelPaginatorMetaDto {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export type AccountErrorCode =
  | 'invalid_input'
  | 'validation'
  | 'not_found'
  | 'forbidden'
  | 'unavailable'
  | 'unauthenticated'
  | 'rate_limited';

/**
 * The backend's error `code`s the store acts on, grouped:
 * - payment (checkout, confirm, retry): `payment_provider_unavailable` →
 *   `provider_unavailable`, `payment_not_found`, `order_payment_closed` → `payment_closed`
 * - checkout: `idempotency_key_used` → `key_used`, `cart_empty`, stock and
 *   availability codes → `cart_items`, the `coupon_*` codes → `coupon`
 */
export type AccountErrorReason =
  | 'provider_unavailable'
  | 'payment_not_found'
  | 'payment_closed'
  | 'key_used'
  | 'cart_empty'
  | 'cart_items'
  | 'coupon'
  /** "Cancel order": the order isn't awaiting payment any more (paid, cancelled, failed). */
  | 'not_cancellable'
  /** Checkout: we don't deliver to this address (no delivery zone). */
  | 'address_not_deliverable'
  /** Checkout: this address's zone doesn't offer the chosen shipping method. */
  | 'shipping_method_unavailable';

export type ReturnCreateField =
  | 'order_item_id'
  | 'quantity'
  | 'reason'
  | 'note'
  | 'return_request'
  | 'status'
  | 'refund_iban'
  | 'refund_account_name';

export type ReturnCreateFields = Partial<Record<ReturnCreateField, string>>;

export type ReviewCreateField =
  | 'order_item_id'
  | 'rating'
  | 'comment';

export type ReviewCreateFields = Partial<Record<ReviewCreateField, string>>;

export type ProductQuestionCreateField = 'product_id' | 'question';

export type ProductQuestionCreateFields = Partial<
  Record<ProductQuestionCreateField, string>
>;

export type BulkOrderCreateField =
  | 'product_id'
  | 'variant_id'
  | 'quantity'
  | 'note'
  | 'bulk_order_request'
  | 'status';

export type BulkOrderCreateFields = Partial<
  Record<BulkOrderCreateField, string>
>;

/** The bank account for refunds; values are the backend's (translated) messages. */
export type RefundAccountField = 'refund_iban' | 'refund_account_name';

export type RefundAccountFields = Partial<Record<RefundAccountField, string>>;

export interface AccountRefundAccountJson {
  ok: true;
  /** `null` when no bank account is saved. */
  account: RefundBankAccount | null;
}

export interface AccountClientError {
  ok: false;
  code: AccountErrorCode;
  error?: string;
  /** Which known backend error a 422 was (checkout, confirm/retry payment). */
  reason?: AccountErrorReason;
  fields?:
    | ReturnCreateFields
    | ReviewCreateFields
    | ProductQuestionCreateFields
    | BulkOrderCreateFields
    | RefundAccountFields;
}

export interface AccountAddressesJson {
  ok: true;
  addresses: Address[];
}

export interface AccountAddressJson {
  ok: true;
  address: Address;
}

export interface AccountDeleteJson {
  ok: true;
}

export interface AccountDeletionCheckJson {
  ok: true;
  check: AccountDeletionCheck;
}

/**
 * `DELETE /api/account/delete` failures. `blocked`: an order, refund or return
 * is still open (its `blockers` may be empty when the backend didn't list them).
 */
export type DeleteAccountErrorCode =
  | 'invalid_input'
  | 'incorrect_password'
  | 'blocked'
  | 'too_many_attempts'
  | 'validation'
  | 'forbidden'
  | 'unauthenticated'
  | 'unavailable';

export interface DeleteAccountErrorJson {
  ok: false;
  code: DeleteAccountErrorCode;
  blockers?: AccountDeletionBlocker[];
}

export interface AccountOrdersJson {
  ok: true;
  orders: AccountOrder[];
  meta: AccountOrdersMeta;
}

export interface AccountOrderJson {
  ok: true;
  order: AccountOrderDetail;
}

/** What "Cancel order" put back in the cart (the backend's `meta.cart`). */
export interface OrderCancelCart {
  restored: number;
  /** Lines that couldn't go back (sold out, no longer sold); the backend's English names. */
  skipped: string[];
}

export interface AccountOrderCancelJson {
  ok: true;
  order: AccountOrderDetail;
  cart: OrderCancelCart;
}

export type LaravelReturnStatusDto =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export interface LaravelReturnOrderItemDto {
  id: number;
  product_id: number | null;
  /** Since 08/10/2026 (#25). */
  bundle_name_ar?: string | null;
  product_name: string;
  product_name_ar?: string | null;
  bundle_name?: string | null;
  sku: string | null;
  /** Full URL. */
  image_url: string | null;
  ordered_quantity: number;
}

export interface LaravelReturnRequestDto {
  id: number;
  sub_order_id: number;
  sub_order_number?: string;
  order_item?: LaravelReturnOrderItemDto;
  quantity: number;
  /** One of the codes from GET /customer/returns/reasons. */
  reason: string;
  reason_label: string;
  reason_label_ar: string | null;
  note: string | null;
  status: LaravelReturnStatusDto;
  refund_amount: string | number | null;
  /** `succeeded`, `failed`, `pending`, or `null` (nothing charged to refund). */
  refund_status?: string | null;
  merchant_note: string | null;
  resolved_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AccountReturnsJson {
  ok: true;
  returns: AccountReturnRequest[];
  meta: AccountReturnsMeta;
}

export interface AccountReturnJson {
  ok: true;
  returnRequest: AccountReturnRequest;
}

export interface AccountShippingMethodsJson {
  ok: true;
  methods: ShippingMethodOption[];
}

export interface AccountCouponPreviewJson {
  ok: true;
  preview: CouponPreview;
}

export interface AccountReturnReasonsJson {
  ok: true;
  reasons: AccountReturnReasons;
}

export interface AccountReviewsJson {
  ok: true;
  reviews: AccountReview[];
  meta: AccountReviewsMeta;
}

export interface AccountReviewJson {
  ok: true;
  review: AccountReview;
}

export interface ReturnCreateErrorJson {
  ok: false;
  code: AccountErrorCode;
  error?: string;
  fields?: ReturnCreateFields;
}

export interface ReviewCreateErrorJson {
  ok: false;
  code: AccountErrorCode;
  error?: string;
  fields?: ReviewCreateFields;
}

export interface AccountProductQuestionsJson {
  ok: true;
  questions: AccountProductQuestion[];
  meta: AccountProductQuestionsMeta;
}

export interface AccountProductQuestionJson {
  ok: true;
  question: AccountProductQuestion;
}

export interface ProductQuestionCreateErrorJson {
  ok: false;
  code: AccountErrorCode;
  error?: string;
  fields?: ProductQuestionCreateFields;
}

export interface AccountBulkOrderRequestsJson {
  ok: true;
  requests: AccountBulkOrderRequest[];
  meta: AccountBulkOrderRequestsMeta;
}

export interface AccountBulkOrderRequestJson {
  ok: true;
  request: AccountBulkOrderRequest;
}

export interface BulkOrderCreateErrorJson {
  ok: false;
  code: AccountErrorCode;
  error?: string;
  fields?: BulkOrderCreateFields;
}

export type ProfileUpdateField = 'name' | 'phone' | 'date_of_birth' | 'gender' | 'avatar';

export type ProfileUpdateFieldCode =
  | 'required'
  | 'too_long'
  | 'invalid'
  | 'taken'
  | 'too_large'
  | 'wrong_type';

export type ProfileUpdateFields = Partial<
  Record<ProfileUpdateField, ProfileUpdateFieldCode>
>;

export interface ProfileUpdateSuccessJson {
  ok: true;
  user: User;
}

export interface ProfileUpdateErrorJson {
  ok: false;
  code: 'invalid_input' | 'validation' | 'unauthenticated' | 'unavailable';
  fields?: ProfileUpdateFields;
}
