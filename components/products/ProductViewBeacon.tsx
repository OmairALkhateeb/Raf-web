'use client';

import { useEffect } from 'react';

const SEEN_KEY = 'raf-viewed-products';

/**
 * Counts one view per product per browser session (#22). The page itself
 * fetches the product with `count_view=0`, so crawlers and re-renders don't count.
 */
export default function ProductViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    let seen: string[] = [];
    try {
      seen = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[];
    } catch {
      seen = [];
    }
    if (Array.isArray(seen) && seen.includes(slug)) return;
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...(Array.isArray(seen) ? seen : []), slug].slice(-200)));
    } catch {
      // Storage blocked: still count this view.
    }
    void fetch(`/api/public/products/${encodeURIComponent(slug)}/view`, { method: 'POST', keepalive: true }).catch(
      () => undefined,
    );
  }, [slug]);
  return null;
}
