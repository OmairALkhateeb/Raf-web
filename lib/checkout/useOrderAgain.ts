'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import type { AccountOrderDetail } from '@/types';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * "Order again" for an order that wasn't paid (guide §5.7): the cart was
 * emptied at checkout, so its products and bundles go back in, then the cart
 * opens. Lines that can't be added (sold out, no longer sold) are named.
 *
 * How many bundles were bought comes from `bundleQuantity` (orders from
 * 14/10). Older orders don't say, so it is the largest number that divides
 * every line's quantity: exact whenever the bundle holds one of each product.
 */
export function useOrderAgain() {
  const router = useRouter();
  const { addToCart, addBundleToCart } = useCart();
  const { showToast } = useApp();
  const { t, language } = useLanguage();
  const [busy, setBusy] = useState(false);

  const orderAgain = useCallback(
    async (order: AccountOrderDetail) => {
      if (busy) return;
      setBusy(true);
      const missed: string[] = [];
      let added = 0;

      const bundles = new Map<number, { name: string; quantity: number }>();
      for (const item of order.items) {
        if (item.productBundleId === null) {
          const result = await addToCart({
            productId: item.productId,
            variantId: item.variantId ?? undefined,
            quantity: item.quantity,
          });
          if (result.ok) added += 1;
          else missed.push(pickLocalized(language, item.productName, item.productNameAr));
          continue;
        }
        const name = item.bundleName
          ? pickLocalized(language, item.bundleName, item.bundleNameAr)
          : t.bundles.bundle;
        const bundle = bundles.get(item.productBundleId);
        bundles.set(item.productBundleId, {
          name,
          quantity:
            item.bundleQuantity ?? (bundle ? gcd(bundle.quantity, item.quantity) : item.quantity),
        });
      }

      for (const [bundleId, bundle] of bundles) {
        const result = await addBundleToCart(bundleId, Math.max(1, bundle.quantity));
        if (result.ok) added += 1;
        else missed.push(bundle.name);
      }

      setBusy(false);
      if (added === 0) {
        showToast(t.account.orderAgainNone, 'error');
        return;
      }
      showToast(
        missed.length > 0
          ? t.account.orderAgainPartial.replace('{names}', missed.join(t.common.listSeparator))
          : t.account.orderAgainAdded,
        missed.length > 0 ? 'info' : 'success',
      );
      router.push('/cart');
    },
    [busy, addToCart, addBundleToCart, showToast, t, language, router],
  );

  return { orderAgain, busy };
}
