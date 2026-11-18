'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRefundAccount } from '@/lib/api/account';
import type { RefundBankAccount } from '@/types';
import type { AccountErrorCode } from '@/types/api/account';

export type RefundAccountState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; account: RefundBankAccount | null }
  | { status: 'error'; code: AccountErrorCode };

/**
 * The bank account for refunds, loaded while `enabled` (only the pages that
 * show it ask for it; it isn't kept on the signed-in user).
 */
export function useRefundAccount(enabled: boolean) {
  const [state, setState] = useState<RefundAccountState>({ status: 'idle' });
  const epochRef = useRef(0);

  const fetchNow = useCallback(async () => {
    const epoch = ++epochRef.current;
    const result = await fetchRefundAccount();
    if (epoch !== epochRef.current) return;
    setState(
      result.ok
        ? { status: 'ready', account: result.data }
        : { status: 'error', code: result.code },
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void (async () => {
      await fetchNow();
    })();
  }, [enabled, fetchNow]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    void fetchNow();
  }, [fetchNow]);

  /** After this page saved or removed it: no need to ask again. */
  const setAccount = useCallback((account: RefundBankAccount | null) => {
    epochRef.current += 1;
    setState({ status: 'ready', account });
  }, []);

  const view: RefundAccountState =
    enabled && state.status === 'idle' ? { status: 'loading' } : state;
  return { state: view, reload, setAccount };
}
