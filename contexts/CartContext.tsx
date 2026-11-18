'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { CartBundleLine, CartIssue, CartItem, CartMergeNote, CartSnapshot, CartTotals } from '@/types';
import type { CartClientError } from '@/types/api/cart';
import {
  addCartBundle,
  addCartItem,
  getCart,
  mergeCart,
  removeCartBundle,
  removeCartItem,
  updateCartBundle,
  updateCartItem,
} from '@/lib/api/cart';
import { uniqueItemIds } from '@/lib/cart/ids';
import { useAuth } from '@/contexts/AuthContext';

const LEGACY_CART_KEY = 'raf-cart';
const LEGACY_MIGRATED_KEY = 'raf-cart-migrated-v1';
/** Unsupported checkout notes — clear leftover browser storage only. */
const LEGACY_NOTES_KEY = 'raf-order-notes';

export type CartStatus = 'loading' | 'ready' | 'unavailable';

export type AddToCartInput = {
  productId: number;
  quantity?: number;
  variantId?: number;
  /** Lets the cart link back to the product page (see lib/cart/product-links). */
  slug?: string;
};

export type CartMutationResult = { ok: true } | CartClientError;

const notReady: CartClientError = { ok: false, code: 'unavailable' };

interface CartContextType {
  items: CartItem[];
  bundles: CartBundleLine[];
  issues: CartIssue[];
  status: CartStatus;
  isReady: boolean;
  isMutating: boolean;
  addToCart: (input: AddToCartInput) => Promise<CartMutationResult>;
  removeFromCart: (itemId: number) => Promise<CartMutationResult>;
  updateQuantity: (itemId: number, qty: number) => Promise<CartMutationResult>;
  clearCart: () => Promise<CartMutationResult>;
  refreshCart: () => Promise<void>;
  addBundleToCart: (bundleId: number, quantity?: number) => Promise<CartMutationResult>;
  updateBundleQuantity: (bundleItemId: number, qty: number) => Promise<CartMutationResult>;
  removeBundleFromCart: (bundleItemId: number) => Promise<CartMutationResult>;
  /**
   * Lines from the guest cart that the login merge left out (out of stock or
   * no longer sold); the backend drops them silently (backend note 30).
   */
  mergeDroppedCount: number;
  /** What the login merge dropped or reduced, by name (backend #30). */
  mergeNotes: CartMergeNote[];
  dismissMergeNotice: () => void;
  /** Products plus bundles, by quantity. */
  itemCount: number;
  /** True when there are product or bundle lines. */
  hasLines: boolean;
  subtotal: number;
  /** Shipping, tax and grand total from the backend; `null` until loaded. */
  totals: CartTotals | null;
  currency: string;
  isInCart: (productId: string | number) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function discardLegacyCart() {
  try {
    localStorage.removeItem(LEGACY_CART_KEY);
    localStorage.setItem(LEGACY_MIGRATED_KEY, '1');
  } catch {
    // private mode
  }
}

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [bundles, setBundles] = useState<CartBundleLine[]>([]);
  const [issues, setIssues] = useState<CartIssue[]>([]);
  const [mergeDroppedCount, setMergeDroppedCount] = useState(0);
  const [mergeNotes, setMergeNotes] = useState<CartMergeNote[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [totals, setTotals] = useState<CartTotals | null>(null);
  const [currency, setCurrency] = useState('OMR');
  const [status, setStatus] = useState<CartStatus>('loading');
  const [isMutating, setIsMutating] = useState(false);

  const itemsRef = useRef<CartItem[]>([]);
  const bundlesRef = useRef<CartBundleLine[]>([]);
  const issuesRef = useRef<CartIssue[]>([]);
  const statusRef = useRef<CartStatus>('loading');
  const chainRef = useRef(Promise.resolve());
  const epochRef = useRef(0);
  const prevAuthRef = useRef<boolean | null>(null);

  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = chainRef.current.then(fn, fn);
    chainRef.current = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }, []);

  const applySuccess = useCallback((cart: Omit<CartSnapshot, 'cartId'> & { cartId?: number }, epoch: number) => {
    if (epoch !== epochRef.current) return;
    const cartBundles = cart.bundles ?? [];
    itemsRef.current = cart.items;
    bundlesRef.current = cartBundles;
    issuesRef.current = cart.issues;
    statusRef.current = 'ready';
    setItems(cart.items);
    setBundles(cartBundles);
    setIssues(cart.issues);
    setSubtotal(cart.subtotal);
    setTotals(cart.totals ?? null);
    setCurrency(cart.currency || 'OMR');
    setStatus('ready');
  }, []);

  const resetVisibleCart = useCallback((epoch: number) => {
    if (epoch !== epochRef.current) return;
    itemsRef.current = [];
    bundlesRef.current = [];
    issuesRef.current = [];
    statusRef.current = 'loading';
    setItems([]);
    setBundles([]);
    setIssues([]);
    setSubtotal(0);
    setTotals(null);
    setStatus('loading');
  }, []);

  const loadCart = useCallback(async () => {
    const epoch = epochRef.current;
    const result = await getCart();
    if (epoch !== epochRef.current) return;
    if (result.ok) {
      applySuccess(result.cart, epoch);
      discardLegacyCart();
      return;
    }
    if (statusRef.current !== 'ready') {
      statusRef.current = 'unavailable';
      setStatus('unavailable');
    }
  }, [applySuccess]);

  const mergeThenLoad = useCallback(async (
    guestBefore?: { items: CartItem[]; bundles: CartBundleLine[] },
  ) => {
    const epoch = epochRef.current;
    const merged = await mergeCart();
    if (epoch !== epochRef.current) return;
    if (merged.ok) {
      if (merged.cart.mergeNotes) {
        // The backend names what it dropped or capped (#30).
        setMergeNotes(merged.cart.mergeNotes);
        setMergeDroppedCount(merged.cart.mergeNotes.length);
      } else if (guestBefore) {
        const productKeys = new Set(
          merged.cart.items.map(i => `${i.productId}:${i.variantId ?? ''}`),
        );
        const bundleIds = new Set((merged.cart.bundles ?? []).map(b => b.bundleId));
        const dropped =
          guestBefore.items.filter(i => !productKeys.has(`${i.productId}:${i.variantId ?? ''}`)).length +
          guestBefore.bundles.filter(b => !bundleIds.has(b.bundleId)).length;
        setMergeDroppedCount(dropped);
      }
      applySuccess(merged.cart, epoch);
      discardLegacyCart();
      return;
    }
    await loadCart();
  }, [applySuccess, loadCart]);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_NOTES_KEY);
    } catch {
      // private mode
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;

    const wasAuth = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (wasAuth === null) {
      void enqueue(() => (isAuthenticated ? mergeThenLoad() : loadCart()));
      return;
    }

    if (!wasAuth && isAuthenticated) {
      // What the guest saw, to spot lines the merge silently drops.
      const guestBefore = { items: itemsRef.current, bundles: bundlesRef.current };
      epochRef.current += 1;
      void enqueue(() => mergeThenLoad(guestBefore));
      return;
    }

    if (wasAuth && !isAuthenticated) {
      epochRef.current += 1;
      const epoch = epochRef.current;
      void Promise.resolve().then(() => resetVisibleCart(epoch));
      void enqueue(() => loadCart());
    }
  }, [enqueue, isAuthLoading, isAuthenticated, loadCart, mergeThenLoad, resetVisibleCart]);

  const refreshCart = useCallback(async () => {
    if (statusRef.current !== 'ready') {
      statusRef.current = 'loading';
      setStatus('loading');
    }
    await enqueue(() => loadCart());
  }, [enqueue, loadCart]);

  const addToCart = useCallback(async (input: AddToCartInput): Promise<CartMutationResult> => {
    return enqueue(async () => {
      if (statusRef.current !== 'ready') return notReady;
      const epoch = epochRef.current;
      const quantity = input.quantity ?? 1;
      setIsMutating(true);
      try {
        const result = await addCartItem({
          productId: input.productId,
          quantity,
          variantId: input.variantId,
        });
        if (result.ok) {
          applySuccess(result.cart, epoch);
          return { ok: true as const };
        }
        return result;
      } finally {
        setIsMutating(false);
      }
    });
  }, [applySuccess, enqueue]);

  const removeFromCart = useCallback(async (itemId: number): Promise<CartMutationResult> => {
    return enqueue(async () => {
      if (statusRef.current !== 'ready') return notReady;
      const epoch = epochRef.current;
      setIsMutating(true);
      try {
        const result = await removeCartItem(itemId);
        if (result.ok) {
          applySuccess(result.cart, epoch);
          return { ok: true as const };
        }
        return result;
      } finally {
        setIsMutating(false);
      }
    });
  }, [applySuccess, enqueue]);

  const updateQuantity = useCallback(async (itemId: number, qty: number): Promise<CartMutationResult> => {
    return enqueue(async () => {
      if (statusRef.current !== 'ready') return notReady;
      const epoch = epochRef.current;
      setIsMutating(true);
      try {
        const result = await updateCartItem(itemId, qty);
        if (result.ok) {
          applySuccess(result.cart, epoch);
          return { ok: true as const };
        }
        return result;
      } finally {
        setIsMutating(false);
      }
    });
  }, [applySuccess, enqueue]);

  const runBundleMutation = useCallback(
    (call: () => ReturnType<typeof addCartBundle>): Promise<CartMutationResult> =>
      enqueue(async () => {
        if (statusRef.current !== 'ready') return notReady;
        const epoch = epochRef.current;
        setIsMutating(true);
        try {
          const result = await call();
          if (result.ok) {
            applySuccess(result.cart, epoch);
            return { ok: true as const };
          }
          return result;
        } finally {
          setIsMutating(false);
        }
      }),
    [applySuccess, enqueue],
  );

  const addBundleToCart = useCallback(
    (bundleId: number, quantity = 1) => runBundleMutation(() => addCartBundle(bundleId, quantity)),
    [runBundleMutation],
  );
  const updateBundleQuantity = useCallback(
    (bundleItemId: number, qty: number) =>
      runBundleMutation(() => updateCartBundle(bundleItemId, qty)),
    [runBundleMutation],
  );
  const removeBundleFromCart = useCallback(
    (bundleItemId: number) => runBundleMutation(() => removeCartBundle(bundleItemId)),
    [runBundleMutation],
  );
  const dismissMergeNotice = useCallback(() => {
    setMergeDroppedCount(0);
    setMergeNotes([]);
  }, []);

  const clearCart = useCallback(async (): Promise<CartMutationResult> => {
    return enqueue(async () => {
      if (statusRef.current !== 'ready') return notReady;
      const epoch = epochRef.current;
      const ids = uniqueItemIds(
        itemsRef.current.map(item => item.itemId),
        issuesRef.current
          .map(issue => issue.itemId)
          .filter((id): id is number => id !== null),
      );
      const bundleIds = Array.from(new Set([
        ...bundlesRef.current.map(line => line.bundleItemId),
        ...issuesRef.current
          .map(issue => issue.bundleItemId)
          .filter((id): id is number => id !== null),
      ]));
      if (ids.length === 0 && bundleIds.length === 0) return { ok: true as const };

      setIsMutating(true);
      try {
        let lastError: CartClientError | null = null;
        const removals = [
          ...ids.map(id => () => removeCartItem(id)),
          ...bundleIds.map(id => () => removeCartBundle(id)),
        ];
        for (const remove of removals) {
          if (epoch !== epochRef.current) return notReady;
          const result = await remove();
          if (result.ok) {
            applySuccess(result.cart, epoch);
          } else {
            lastError = result;
            break;
          }
        }
        return lastError ?? { ok: true as const };
      } finally {
        setIsMutating(false);
      }
    });
  }, [applySuccess, enqueue]);

  const itemCount =
    items.reduce((sum, item) => sum + item.quantity, 0) +
    bundles.reduce((sum, line) => sum + line.quantity, 0);
  const hasLines = items.length > 0 || bundles.length > 0;
  const isReady = status === 'ready';
  const isInCart = (productId: string | number) =>
    items.some(item => String(item.productId) === String(productId));

  return (
    <CartContext.Provider value={{
      items,
      bundles,
      issues,
      status,
      isReady,
      isMutating,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refreshCart,
      addBundleToCart,
      updateBundleQuantity,
      removeBundleFromCart,
      mergeDroppedCount,
      mergeNotes,
      dismissMergeNotice,
      itemCount,
      hasLines,
      subtotal,
      totals,
      currency,
      isInCart,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
