'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Package } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import AccountSidebar from '@/components/account/AccountSidebar';
import {
  acceptBulkOrderRequest,
  cancelBulkOrderRequest,
  fetchBulkOrderRequests,
} from '@/lib/api/account';
import { localizeBulkOrderError } from '@/lib/account/messages';
import { AccountPageSkeleton, ListSkeleton } from '@/components/common/Loading';
import {
  BULK_ORDERS_CHANGED_EVENT,
  bulkOrderStatusPresentation,
  canAcceptBulkOrder,
  canCancelBulkOrder,
} from '@/lib/account/bulk-orders';
import type {
  AccountBulkOrderRequest,
  AccountBulkOrderRequestsMeta,
} from '@/types';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

function formatDate(iso: string, language: 'en' | 'ar'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(language === 'ar' ? 'ar-OM' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type ConfirmKind = 'accept' | 'cancel';

export default function AccountBulkOrdersPage() {
  const router = useRouter();
  const { language, t, isRTL } = useLanguage();
  const { showToast } = useApp();
  const { user, isAuthenticated, isAuthLoading, logout } = useAuth();

  const [requests, setRequests] = useState<AccountBulkOrderRequest[]>([]);
  const [meta, setMeta] = useState<AccountBulkOrderRequestsMeta | null>(null);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);

  const [confirm, setConfirm] = useState<{
    kind: ConfirmKind;
    row: AccountBulkOrderRequest;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const epochRef = useRef(0);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  const handleAuthFailure = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [logout, router]);

  const loadRequests = useCallback(
    async (pageNum: number) => {
      const epoch = ++epochRef.current;
      setListLoading(true);
      setListError(false);
      const result = await fetchBulkOrderRequests(pageNum);
      if (epoch !== epochRef.current) return;
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await handleAuthFailure();
          return;
        }
        setRequests([]);
        setMeta(null);
        setListError(true);
        setListLoading(false);
        return;
      }
      setRequests(result.data.requests);
      setMeta(result.data.meta);
      setPage(result.data.meta.currentPage);
      setListLoading(false);
    },
    [handleAuthFailure],
  );

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      await loadRequests(page);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, page, loadRequests]);

  useEffect(() => {
    const onChanged = () => {
      if (isAuthLoading || !isAuthenticated) return;
      void loadRequests(page);
    };
    window.addEventListener(BULK_ORDERS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(BULK_ORDERS_CHANGED_EVENT, onChanged);
    };
  }, [isAuthLoading, isAuthenticated, loadRequests, page]);

  const closeConfirm = useCallback(() => {
    if (confirmingRef.current) return;
    setConfirm(null);
  }, []);

  useEffect(() => {
    if (!confirm) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [confirm, closeConfirm]);

  const handleLogout = async () => {
    await logout();
    showToast(t.common.signedOut, 'success');
    router.push('/');
  };

  const runConfirm = async () => {
    if (!confirm || confirmingRef.current || confirming) return;
    confirmingRef.current = true;
    setConfirming(true);
    try {
      if (confirm.kind === 'accept') {
        const result = await acceptBulkOrderRequest(confirm.row.id);
        if (!result.ok) {
          if (result.code === 'unauthenticated') {
            await handleAuthFailure();
            return;
          }
          showToast(localizeBulkOrderError(result, t), 'error');
          return;
        }
        showToast(t.account.bulkAcceptedToast, 'success');
        setConfirm(null);
        await loadRequests(page);
        return;
      }

      const result = await cancelBulkOrderRequest(confirm.row.id);
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await handleAuthFailure();
          return;
        }
        showToast(localizeBulkOrderError(result, t), 'error');
        return;
      }
      showToast(t.account.bulkCancelledToast, 'success');
      setConfirm(null);
      await loadRequests(page);
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  if (isAuthLoading || !isAuthenticated || !user) {
    return <AccountPageSkeleton label={t.common.loading} />;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.account.title}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.account.myBulkOrders}
          </h1>
        </div>
      </div>

      <div className={`${cx} py-14 sm:py-20`}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10">
          <AccountSidebar user={user} onLogout={() => void handleLogout()} />

          <div className="space-y-6">
            <div
              className="flex flex-wrap items-center justify-between gap-4"
            >
              <p className="text-sm text-[#2D1F1F]/45 leading-relaxed max-w-xl">
                {t.account.bulkOrdersHint}
              </p>
              <Link
                href="/products"
                className="shrink-0 h-11 px-5 inline-flex items-center bg-[#2D1F1F] text-white text-[10px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors"
              >
                {t.account.bulkStartFromProduct}
              </Link>
            </div>

            {listLoading ? (
              <ListSkeleton rows={3} label={t.common.loading} />
            ) : listError ? (
              <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-12 text-center">
                <p className="text-sm text-[#2D1F1F]/55 mb-4" role="alert">
                  {t.account.bulkOrdersLoadError}
                </p>
                <button
                  type="button"
                  onClick={() => void loadRequests(page)}
                  className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F]"
                >
                  {t.common.retry}
                </button>
              </div>
            ) : requests.length === 0 ? (
              <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-16 text-center">
                <Package
                  size={32}
                  strokeWidth={1}
                  className="text-[#2D1F1F]/15 mx-auto mb-4"
                />
                <p className="text-sm text-[#2D1F1F]/40">
                  {t.account.noBulkOrdersYet}
                </p>
              </div>
            ) : (
              <>
                <ul className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden divide-y divide-[#2D1F1F]/8">
                  {requests.map((row) => {
                    const chip = bulkOrderStatusPresentation(
                      row.status,
                      t.account,
                    );
                    const title = row.productName
                      ? pickLocalized(language, row.productName, row.productNameAr)
                      : `${t.account.bulkProductFallback} #${row.productId}`;
                    return (
                      <li
                        key={row.id}
                        className={`px-6 py-5 ${isRTL ? 'text-right' : ''}`}
                      >
                        <div
                          className="flex flex-wrap items-center gap-3 mb-2"
                        >
                          <p className="text-sm font-bold text-[#2D1F1F]">
                            {title}
                          </p>
                          <span
                            className={`px-3 py-1 text-[10px] font-black tracking-[0.12em] uppercase rounded-md ${chip.bg} ${chip.text}`}
                          >
                            {chip.label}
                          </span>
                        </div>
                        <p className="text-xs text-[#2D1F1F]/40 mb-2">
                          {formatDate(row.createdAt, language)}
                          {' · '}
                          {t.account.bulkQuantity}: {row.quantity}
                          {row.variantId != null
                            ? ` · #${row.variantId}`
                            : ''}
                        </p>
                        {row.note ? (
                          <p className="text-sm text-[#2D1F1F]/70 mb-2 leading-relaxed">
                            {row.note}
                          </p>
                        ) : null}
                        {row.quotedUnitPrice ? (
                          <p className="text-sm text-[#2D1F1F] mb-1">
                            <span className="text-[10px] font-black tracking-[0.15em] uppercase text-[#2D1F1F]/40 me-2">
                              {t.account.bulkQuotedUnitPrice}
                            </span>
                            {row.quotedUnitPrice}
                          </p>
                        ) : null}
                        {row.quotedNote ? (
                          <div className="mt-2 border border-[#2D1F1F]/8 rounded-md px-4 py-3 bg-[#FAF7F2]">
                            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/40 mb-1">
                              {t.account.bulkQuotedNote}
                            </p>
                            <p className="text-sm text-[#2D1F1F] leading-relaxed">
                              {row.quotedNote}
                            </p>
                          </div>
                        ) : null}
                        {row.respondedAt ? (
                          <p className="text-xs text-[#2D1F1F]/40 mt-2">
                            {t.account.bulkRespondedAt}:{' '}
                            {formatDate(row.respondedAt, language)}
                          </p>
                        ) : null}
                        {(canAcceptBulkOrder(row) ||
                          canCancelBulkOrder(row)) && (
                          <div
                            className="mt-4 flex flex-wrap gap-3"
                          >
                            {canAcceptBulkOrder(row) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirm({ kind: 'accept', row })
                                }
                                className="h-10 px-4 bg-[#2D1F1F] text-white text-[10px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors"
                              >
                                {t.account.bulkAccept}
                              </button>
                            ) : null}
                            {canCancelBulkOrder(row) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirm({ kind: 'cancel', row })
                                }
                                className="h-10 px-4 border border-[#2D1F1F]/15 text-[#2D1F1F] text-[10px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#FAF7F2] transition-colors"
                              >
                                {t.account.bulkCancel}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {meta && meta.lastPage > 1 ? (
                  <div
                    className="flex items-center justify-between gap-4"
                  >
                    <button
                      type="button"
                      disabled={page <= 1 || listLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] disabled:opacity-30"
                    >
                      {t.account.bulkPreviousPage}
                    </button>
                    <span className="text-xs text-[#2D1F1F]/45">
                      {t.account.bulkPageOf} {meta.currentPage} /{' '}
                      {meta.lastPage}
                    </span>
                    <button
                      type="button"
                      disabled={page >= meta.lastPage || listLoading}
                      onClick={() =>
                        setPage((p) =>
                          meta ? Math.min(meta.lastPage, p + 1) : p,
                        )
                      }
                      className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] disabled:opacity-30"
                    >
                      {t.account.bulkNextPage}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {confirm ? (
                <motion.div
                  key="bulk-confirm-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                >
                  <div
                    className="absolute inset-0 bg-black/40"
                    onClick={closeConfirm}
                    aria-hidden="true"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{
                      type: 'spring',
                      damping: 28,
                      stiffness: 320,
                    }}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl max-h-[min(90vh,100%)] overflow-y-auto"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="bulk-confirm-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-6 sm:p-8">
                      <h2
                        id="bulk-confirm-title"
                        className="text-lg font-serif text-[#2D1F1F] mb-3"
                      >
                        {confirm.kind === 'accept'
                          ? t.account.bulkAcceptConfirmTitle
                          : t.account.bulkCancelConfirmTitle}
                      </h2>
                      <p className="text-sm text-[#2D1F1F]/55 leading-relaxed mb-6">
                        {confirm.kind === 'accept'
                          ? t.account.bulkAcceptConfirmBody
                          : t.account.bulkCancelConfirmBody}
                      </p>
                      <div
                        className="flex gap-3"
                      >
                        <button
                          type="button"
                          disabled={confirming}
                          onClick={() => void runConfirm()}
                          className="flex-1 h-11 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
                        >
                          {confirming ? (
                            <Loader2
                              size={14}
                              className="animate-spin"
                              aria-hidden
                            />
                          ) : null}
                          {confirming
                            ? t.account.bulkConfirmWorking
                            : confirm.kind === 'accept'
                              ? t.account.bulkAcceptConfirmAction
                              : t.account.bulkCancelConfirmAction}
                        </button>
                        <button
                          type="button"
                          disabled={confirming}
                          onClick={closeConfirm}
                          className="flex-1 h-11 border border-[#2D1F1F]/15 text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#FAF7F2] transition-colors disabled:opacity-40"
                        >
                          {t.account.bulkConfirmDismiss}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
