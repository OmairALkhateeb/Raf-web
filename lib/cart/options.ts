/** "Size: 100ml · Colour: Gold", as on the order page; `null` when there's nothing to show. */
export function formatLineOptions(options: Record<string, string> | null): string | null {
  if (!options) return null;
  const parts = Object.entries(options).map(([key, value]) => `${key}: ${value}`);
  return parts.length ? parts.join(' · ') : null;
}
