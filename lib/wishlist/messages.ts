import type {
  WishlistClientError,
  WishlistErrorCode,
} from '@/types/api/wishlist';
import type { Dictionary } from '@/utils/translations';

export function localizeWishlistError(
  error: WishlistClientError,
  t: Dictionary,
): string {
  switch (error.code) {
    case 'unauthenticated':
      return t.wishlist.signInToUse;
    case 'unavailable':
      return t.wishlist.unavailable;
    case 'not_found':
      return t.wishlist.itemNotFound;
    case 'forbidden':
      return t.wishlist.cannotChange;
    case 'invalid_input':
    case 'validation':
      return t.wishlist.cannotSave;
    default:
      return t.wishlist.unavailable;
  }
}

export function isWishlistErrorCode(
  value: unknown,
): value is WishlistErrorCode {
  return (
    value === 'invalid_input' ||
    value === 'validation' ||
    value === 'not_found' ||
    value === 'forbidden' ||
    value === 'unavailable' ||
    value === 'unauthenticated'
  );
}
