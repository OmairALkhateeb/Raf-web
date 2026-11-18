'use client';

import { useEffect, useState } from 'react';

/**
 * The current time in ms, ticking every `intervalMs` while `active` (for a
 * payment countdown). Read it during render instead of calling `Date.now()`.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
