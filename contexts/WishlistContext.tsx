'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Product } from '@/types';
import type {
  WishlistClientError,
  WishlistItemJson,
} from '@/types/api/wishlist';
import {
  addWishlistItem,
  fetchWishlist,
  removeWishlistItem,
} from '@/lib/api/wishlist';
import { parsePositiveIntString } from '@/lib/cart/ids';
import { useAuth } from '@/contexts/AuthContext';

const LEGACY_WISHLIST_KEY = 'raf-wishlist';

export type WishlistStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export type WishlistMutationResult = { ok: true } | WishlistClientError;

interface WishlistContextType {
  items: Product[];
  status: WishlistStatus;
  addToWishlist: (product: Product) => Promise<WishlistMutationResult>;
  removeFromWishlist: (productId: string) => Promise<WishlistMutationResult>;
  toggleWishlist: (product: Product) => Promise<WishlistMutationResult>;
  isInWishlist: (productId: string) => boolean;
  isPending: (productId: string) => boolean;
  refresh: () => Promise<void>;
  count: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(
  undefined,
);

const unauthenticated: WishlistClientError = {
  ok: false,
  code: 'unauthenticated',
};
const unavailable: WishlistClientError = { ok: false, code: 'unavailable' };

function discardLegacyWishlist() {
  try {
    localStorage.removeItem(LEGACY_WISHLIST_KEY);
  } catch {
    // private mode
  }
}

function productKey(productId: string | number): string {
  return String(productId);
}

export const WishlistProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isAuthenticated, isAuthLoading, logout } = useAuth();
  const [entries, setEntries] = useState<WishlistItemJson[]>([]);
  const [status, setStatus] = useState<WishlistStatus>('idle');
  const [pending, setPending] = useState<Set<string>>(new Set());

  const entriesRef = useRef<WishlistItemJson[]>([]);
  const pendingRef = useRef<Set<string>>(new Set());
  const epochRef = useRef(0);
  const inFlightRef = useRef<Map<string, Promise<WishlistMutationResult>>>(
    new Map(),
  );

  const setEntriesSafe = useCallback(
    (next: WishlistItemJson[], epoch: number) => {
      if (epoch !== epochRef.current) return;
      entriesRef.current = next;
      setEntries(next);
    },
    [],
  );

  const markPending = useCallback((key: string, value: boolean) => {
    const next = new Set(pendingRef.current);
    if (value) next.add(key);
    else next.delete(key);
    pendingRef.current = next;
    setPending(next);
  }, []);

  const clearVisible = useCallback((epoch: number) => {
    if (epoch !== epochRef.current) return;
    entriesRef.current = [];
    setEntries([]);
    pendingRef.current = new Set();
    setPending(new Set());
    inFlightRef.current.clear();
  }, []);

  const handleAuthLoss = useCallback(async () => {
    epochRef.current += 1;
    const epoch = epochRef.current;
    clearVisible(epoch);
    setStatus('idle');
    await logout();
  }, [clearVisible, logout]);

  const loadWishlist = useCallback(
    async (epoch: number) => {
      const result = await fetchWishlist();
      if (epoch !== epochRef.current) return;
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await handleAuthLoss();
          return;
        }
        setStatus('unavailable');
        return;
      }
      setEntriesSafe(result.data, epoch);
      setStatus('ready');
    },
    [handleAuthLoss, setEntriesSafe],
  );

  useEffect(() => {
    discardLegacyWishlist();
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;

    const epoch = ++epochRef.current;

    void (async () => {
      if (!isAuthenticated) {
        clearVisible(epoch);
        setStatus('idle');
        return;
      }

      setStatus('loading');
      await loadWishlist(epoch);
    })();
  }, [clearVisible, isAuthLoading, isAuthenticated, loadWishlist]);

  const addToWishlist = useCallback(
    async (product: Product): Promise<WishlistMutationResult> => {
      if (!isAuthenticated) return unauthenticated;
      const key = productKey(product.id);
      const existing = inFlightRef.current.get(`add:${key}`);
      if (existing) return existing;

      const productId = parsePositiveIntString(product.id);
      if (productId === null) return { ok: false, code: 'invalid_input' };

      const epoch = epochRef.current;
      const run = (async (): Promise<WishlistMutationResult> => {
        markPending(key, true);
        try {
          const result = await addWishlistItem({ productId });
          if (epoch !== epochRef.current) return unavailable;
          if (!result.ok) {
            if (result.code === 'unauthenticated') await handleAuthLoss();
            return result;
          }
          const without = entriesRef.current.filter(
            (item) => item.productId !== result.data.productId,
          );
          setEntriesSafe([...without, result.data], epoch);
          setStatus('ready');
          return { ok: true };
        } catch (error) {
          console.error(
            'Wishlist add failed',
            error instanceof Error ? error.name : 'unknown',
          );
          return unavailable;
        } finally {
          markPending(key, false);
          inFlightRef.current.delete(`add:${key}`);
        }
      })();

      inFlightRef.current.set(`add:${key}`, run);
      return run;
    },
    [handleAuthLoss, isAuthenticated, markPending, setEntriesSafe],
  );

  const removeFromWishlist = useCallback(
    async (productId: string): Promise<WishlistMutationResult> => {
      if (!isAuthenticated) return unauthenticated;
      const key = productKey(productId);
      const existing = inFlightRef.current.get(`remove:${key}`);
      if (existing) return existing;

      const entry = entriesRef.current.find(
        (item) => productKey(item.productId) === key,
      );
      if (!entry) return { ok: true };

      const epoch = epochRef.current;
      const run = (async (): Promise<WishlistMutationResult> => {
        markPending(key, true);
        try {
          const result = await removeWishlistItem(entry.id);
          if (epoch !== epochRef.current) return unavailable;
          if (!result.ok) {
            if (result.code === 'unauthenticated') await handleAuthLoss();
            return result;
          }
          setEntriesSafe(
            entriesRef.current.filter((item) => item.id !== entry.id),
            epoch,
          );
          return { ok: true };
        } catch (error) {
          console.error(
            'Wishlist remove failed',
            error instanceof Error ? error.name : 'unknown',
          );
          return unavailable;
        } finally {
          markPending(key, false);
          inFlightRef.current.delete(`remove:${key}`);
        }
      })();

      inFlightRef.current.set(`remove:${key}`, run);
      return run;
    },
    [handleAuthLoss, isAuthenticated, markPending, setEntriesSafe],
  );

  const toggleWishlist = useCallback(
    async (product: Product): Promise<WishlistMutationResult> => {
      const key = productKey(product.id);
      if (
        entriesRef.current.some((item) => productKey(item.productId) === key)
      ) {
        return removeFromWishlist(product.id);
      }
      return addToWishlist(product);
    },
    [addToWishlist, removeFromWishlist],
  );

  const isInWishlist = useCallback(
    (productId: string) =>
      entries.some(
        (item) => productKey(item.productId) === productKey(productId),
      ),
    [entries],
  );

  const isPending = useCallback(
    (productId: string) => pending.has(productKey(productId)),
    [pending],
  );

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    const epoch = epochRef.current;
    setStatus('loading');
    await loadWishlist(epoch);
  }, [isAuthenticated, loadWishlist]);

  return (
    <WishlistContext.Provider
      value={{
        items: entries.map((item) => item.product),
        status,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        isPending,
        refresh,
        count: entries.length,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
};
