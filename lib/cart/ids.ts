/** Finite positive integer from JSON (route handlers reject numeric strings). */
export function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isSafeInteger(value) && value > 0;
}

/** `{item}` path segment or a listing `product.id` string. */
export function parsePositiveIntString(raw: string): number | null {
  if (!/^[1-9][0-9]*$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

export function isQuantity(value: unknown): value is number {
  return isPositiveInt(value) && value <= 999;
}

export function uniqueItemIds(itemIds: number[], issueIds: number[]): number[] {
  return Array.from(new Set([...itemIds, ...issueIds]));
}
