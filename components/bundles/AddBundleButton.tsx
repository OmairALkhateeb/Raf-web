'use client';

import { Loader2, ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cartErrorMessage } from '@/lib/cart/messages';

type Props = {
  bundleId: number;
  inStock: boolean;
  quantity?: number;
  size?: 'sm' | 'lg';
};

/** Adds a bundle to the cart (guests too); disabled when it's out of stock. */
export default function AddBundleButton({ bundleId, inStock, quantity = 1, size = 'sm' }: Props) {
  const { addBundleToCart, isReady, isMutating } = useCart();
  const { showToast } = useApp();
  const { t } = useLanguage();

  const onClick = async () => {
    const result = await addBundleToCart(bundleId, quantity);
    if (result.ok) showToast(t.bundles.added);
    else showToast(cartErrorMessage(result, t), 'error');
  };

  const sizeClass =
    size === 'lg' ? 'h-12 px-8 text-[11px] tracking-[0.25em]' : 'h-10 px-4 text-[10px] tracking-[0.2em]';

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={!inStock || !isReady || isMutating}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-black uppercase transition-colors disabled:cursor-not-allowed ${sizeClass} ${
        inStock
          ? 'bg-[#2D1F1F] text-white hover:bg-[#C9A84C] disabled:opacity-50'
          : 'bg-[#2D1F1F]/10 text-[#2D1F1F]/45'
      }`}
    >
      {isMutating ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <ShoppingBag size={13} aria-hidden />}
      {inStock ? t.bundles.addToCart : t.bundles.outOfStock}
    </button>
  );
}
