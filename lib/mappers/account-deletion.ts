import type {
  AccountDeletionBlocker,
  AccountDeletionBlockerCode,
  AccountDeletionCheck,
} from '@/types';

const KNOWN_BLOCKERS: readonly AccountDeletionBlockerCode[] = [
  'active_orders',
  'pending_refunds',
  'open_returns',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/** A whole number ≥ 0; anything else counts as 0. */
function count(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * `blockers` of the pre-check, or of the 422 `account_deletion_blocked`:
 * `[{ code, count }]`. A code the store doesn't know becomes `other` (it
 * still blocks); repeated codes are added up.
 */
export function parseDeletionBlockers(value: unknown): AccountDeletionBlocker[] {
  if (!Array.isArray(value)) return [];

  const blockers: AccountDeletionBlocker[] = [];
  for (const entry of value) {
    const row = asRecord(entry);
    if (!row) continue;

    const code = KNOWN_BLOCKERS.find((known) => known === row.code) ?? 'other';
    const existing = blockers.find((blocker) => blocker.code === code);
    if (existing) {
      existing.count += count(row.count);
    } else {
      blockers.push({ code, count: count(row.count) });
    }
  }
  return blockers;
}

/**
 * `GET /customer/account/deletion-check` → `{ data: { can_delete, blockers,
 * unpaid_orders_to_cancel, purge_after_days } }`. `purge_after_days` isn't
 * shown, so it isn't kept. `undefined` when the payload isn't a check.
 */
export function parseDeletionCheck(payload: unknown): AccountDeletionCheck | undefined {
  const data = asRecord(asRecord(payload)?.data);
  if (!data || typeof data.can_delete !== 'boolean') return undefined;

  const blockers = parseDeletionBlockers(data.blockers);
  return {
    canDelete: data.can_delete && blockers.length === 0,
    blockers,
    unpaidOrdersToCancel: count(data.unpaid_orders_to_cancel),
  };
}
