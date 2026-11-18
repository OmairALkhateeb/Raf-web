import type { CartClientError } from '@/types/api/cart';
import type { CartIssueReason } from '@/types';
import type { Dictionary } from '@/utils/translations';

type CartCopy = Dictionary;

export function cartErrorMessage(error: CartClientError, t: CartCopy): string {
  if (error.code === 'invalid_input') return t.cart.invalidInput;
  if (error.code === 'not_found') return t.cart.itemNotFound;
  if (error.code === 'unavailable' || error.code === 'unauthenticated') return t.cart.unavailable;

  switch (error.reason) {
    case 'stock':
      return t.cart.stockExceeded;
    case 'variant_required':
      return t.cart.variantRequired;
    case 'variant_unavailable':
      return t.cart.variantNotAvailable;
    case 'product_unavailable':
      return t.cart.productUnavailable;
    case 'item_mismatch':
      return t.cart.itemMismatch;
    case 'bundle_unavailable':
      return t.cart.bundleUnavailable;
    case 'bundle_stock':
      return t.cart.bundleStock;
    case 'quantity_max':
      return t.cart.bundleQuantityMax;
    default:
      break;
  }

  if (error.field === 'quantity') return t.cart.stockExceeded;
  if (error.field === 'variant_id') return t.cart.variantRequired;
  if (error.field === 'product_id') return t.cart.productUnavailable;
  if (error.field === 'item') return t.cart.itemMismatch;
  if (error.field === 'bundle_id') return t.cart.bundleUnavailable;
  return t.cart.unavailable;
}

export function cartIssueMessage(
  reason: CartIssueReason,
  t: CartCopy,
  /** Units left, when the backend says (#21). */
  available?: number | null,
): string {
  if (reason === 'unavailable') return t.cart.issueUnavailable;
  if (reason === 'stock' && typeof available === 'number' && available > 0) {
    return t.cart.issueOnlyLeft.replace('{count}', String(available));
  }
  if (reason === 'stock') return t.cart.issueStock;
  return t.cart.issueUnknown;
}
