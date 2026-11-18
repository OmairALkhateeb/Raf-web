'use client';

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Landmark, Loader2, Package, Undo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  cancelReturn,
  createReturn,
  fetchOrder,
  fetchOrders,
  fetchReturnReasons,
  fetchReturns,
} from '@/lib/api/account';
import { localizeReturnError } from '@/lib/account/messages';
import {
  localizedLabel,
  parseOrderItemIdQuery,
  refundStatusPresentation,
  returnStatusPresentation,
} from '@/lib/account/returns';
import {
  REFUND_ACCOUNT_HREF,
  REFUND_ACCOUNT_NAME_MAX,
  REFUND_IBAN_INPUT_MAX,
  REFUND_IBAN_PLACEHOLDER,
  maskIban,
  validateRefundAccount,
  type RefundAccountInput,
} from '@/lib/account/refund-account';
import { useRefundAccount } from '@/lib/account/useRefundAccount';
import RefundAccountFields from '@/components/account/RefundAccountFields';
import { formatPrice } from '@/utils/formatPrice';
import { ListSkeleton, StorePageSkeleton } from '@/components/common/Loading';
import type {
  AccountOrder,
  AccountReturnReasons,
  AccountReturnRequest,
} from '@/types';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';
const inputClass =
  'w-full h-11 px-4 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';
const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

function formatDate(iso: string, language: 'en' | 'ar'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(language === 'ar' ? 'ar-OM' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={<ReturnsLoadingFallback />}>
      <ReturnsPageContent />
    </Suspense>
  );
}

function ReturnsLoadingFallback() {
  const { t } = useLanguage();
  return <StorePageSkeleton label={t.common.loading} />;
}

function ReturnsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, t, isRTL } = useLanguage();
  const { showToast } = useApp();
  const { isAuthenticated, isAuthLoading, logout } = useAuth();

  const prefillItemId = parseOrderItemIdQuery(searchParams.get('order_item_id'));
  // Set by the order page's "Request return" link, so an item from an order
  // outside the first page of orders can still be picked.
  const prefillOrderId = parseOrderItemIdQuery(searchParams.get('order_id'));

  const [returns, setReturns] = useState<AccountReturnRequest[]>([]);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [reasons, setReasons] = useState<AccountReturnReasons | null>(null);
  const [reasonsError, setReasonsError] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);

  const [orderItemIdOverride, setOrderItemIdOverride] = useState<string | null>(
    null,
  );
  const orderItemId =
    orderItemIdOverride ?? (prefillItemId ? String(prefillItemId) : '');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const submittingRef = useRef(false);
  const cancellingRef = useRef(false);
  const epochRef = useRef(0);
  // Refunds for returns go by bank transfer (guide §5.6, §6.5): ask for the
  // IBAN in the form only when the profile has none, or to change it.
  const { state: bankAccountState, reload: reloadBankAccount } = useRefundAccount(
    !isAuthLoading && isAuthenticated,
  );
  const savedBankAccount =
    bankAccountState.status === 'ready' ? bankAccountState.account : null;
  const [changeBankAccount, setChangeBankAccount] = useState(false);
  const [refundIban, setRefundIban] = useState('');
  const [refundAccountName, setRefundAccountName] = useState('');

  const handleAuthFailure = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [logout, router]);

  const loadLists = useCallback(async () => {
    const epoch = ++epochRef.current;
    setListLoading(true);
    setListError(false);

    const [returnsResult, ordersResult, reasonsResult] = await Promise.all([
      fetchReturns(),
      fetchOrders(),
      fetchReturnReasons(),
    ]);

    if (epoch !== epochRef.current) return;

    let loadedOrders = ordersResult.ok ? ordersResult.data.orders : [];
    if (
      prefillOrderId !== null &&
      !loadedOrders.some((order) => order.id === prefillOrderId)
    ) {
      const extra = await fetchOrder(prefillOrderId);
      if (epoch !== epochRef.current) return;
      if (extra.ok) loadedOrders = [...loadedOrders, extra.data];
    }

    if (!returnsResult.ok) {
      if (returnsResult.code === 'unauthenticated') {
        await handleAuthFailure();
        return;
      }
      setReturns([]);
      setListError(true);
      setListLoading(false);
      return;
    }

    if (!ordersResult.ok && ordersResult.code === 'unauthenticated') {
      await handleAuthFailure();
      return;
    }

    setReturns(returnsResult.data.returns);
    setOrders(loadedOrders);
    setReasons(reasonsResult.ok ? reasonsResult.data : null);
    setReasonsError(!reasonsResult.ok);
    setListLoading(false);
  }, [handleAuthFailure, prefillOrderId]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      await loadLists();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, loadLists]);

  // The backend decides per line (delivered, inside the window, quantity
  // left); a partly delivered order can still have returnable lines.
  const eligibleItems = orders.flatMap((order) =>
    order.items
      .filter((item) => item.canReturn && item.returnableQuantity > 0)
      .map((item) => ({
        orderNumber: order.orderNumber,
        orderId: order.id,
        itemId: item.id,
        productName: pickLocalized(language, item.productName, item.productNameAr),
        maxQuantity: item.returnableQuantity,
        returnWindowEndsAt: item.returnWindowEndsAt,
      })),
  );

  const selectedEligible = eligibleItems.find(
    (item) => String(item.itemId) === orderItemId.trim(),
  );
  const selectedReason = reasons?.reasons.find((r) => r.code === reason);
  const noteRequired = selectedReason?.requiresNote === true;
  const canSubmit = !submitting && eligibleItems.length > 0 && reasons !== null;
  const bankFieldsShown =
    bankAccountState.status === 'ready' && (savedBankAccount === null || changeBankAccount);
  // Completed returns waiting for a transfer while no bank account is saved.
  const awaitingTransferAmount = returns
    .filter((row) => row.refundStatus === 'awaiting_transfer')
    .reduce((sum, row) => sum + (row.refundAmount ?? 0), 0);
  const needsBankAccountBanner =
    bankAccountState.status === 'ready' &&
    savedBankAccount === null &&
    returns.some((row) => row.refundStatus === 'awaiting_transfer');

  const clearBankErrors = (field: 'refund_iban' | 'refund_account_name') =>
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || submitting) return;

    setFieldErrors({});
    const qty = Number.parseInt(quantity, 10);
    const trimmedNote = note.trim();

    const nextErrors: Record<string, string> = {};
    if (!selectedEligible) {
      nextErrors.order_item_id = t.returns.invalidItemId;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      nextErrors.quantity = t.returns.quantityInvalid;
    } else if (selectedEligible && qty > selectedEligible.maxQuantity) {
      nextErrors.quantity = t.returns.quantityTooHigh.replace(
        '{count}',
        String(selectedEligible.maxQuantity),
      );
    }
    if (!selectedReason) {
      nextErrors.reason = t.returns.reasonRequired;
    }
    if (noteRequired && !trimmedNote) {
      nextErrors.note = t.returns.noteRequired;
    } else if (trimmedNote.length > 2000) {
      nextErrors.note = t.returns.noteTooLong;
    }
    // Optional: sent only when something was typed; then both are needed.
    let refundAccount: RefundAccountInput | undefined;
    if (bankFieldsShown && (refundIban.trim() || refundAccountName.trim())) {
      refundAccount = { iban: refundIban, accountName: refundAccountName };
      const codes = validateRefundAccount(refundAccount);
      if (codes.refund_iban) {
        nextErrors.refund_iban =
          codes.refund_iban === 'required' ? t.account.ibanRequired : t.account.ibanInvalid;
      }
      if (codes.refund_account_name) {
        nextErrors.refund_account_name =
          codes.refund_account_name === 'required'
            ? t.account.accountNameRequired
            : t.account.accountNameTooLong;
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await createReturn({
        orderItemId: selectedEligible!.itemId,
        quantity: qty,
        reason: selectedReason!.code,
        note: trimmedNote ? trimmedNote : null,
        refundAccount,
      });
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await handleAuthFailure();
          return;
        }
        if (result.fields) {
          setFieldErrors(result.fields);
        }
        showToast(localizeReturnError(result, t), 'error');
        // The backend saves the bank account before it checks the return.
        if (
          refundAccount &&
          !(result.fields && ('refund_iban' in result.fields || 'refund_account_name' in result.fields))
        ) {
          reloadBankAccount();
        }
        return;
      }
      showToast(t.returns.created, 'success');
      setOrderItemIdOverride('');
      setReason('');
      setNote('');
      setQuantity('1');
      if (refundAccount) {
        setRefundIban('');
        setRefundAccountName('');
        setChangeBankAccount(false);
        reloadBankAccount();
      }
      await loadLists();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const closeCancelModal = useCallback(() => {
    if (cancellingRef.current) return;
    setCancelTargetId(null);
  }, []);

  useEffect(() => {
    if (cancelTargetId === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCancelModal();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cancelTargetId, closeCancelModal]);

  const handleCancelConfirm = async () => {
    if (cancelTargetId === null || cancellingRef.current) return;
    cancellingRef.current = true;
    setCancellingId(cancelTargetId);
    try {
      const result = await cancelReturn(cancelTargetId);
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await handleAuthFailure();
          return;
        }
        showToast(localizeReturnError(result, t), 'error');
        return;
      }
      setReturns((prev) =>
        prev.map((row) =>
          row.id === cancelTargetId
            ? { ...row, status: 'cancelled' as const }
            : row,
        ),
      );
      setCancelTargetId(null);
      showToast(t.returns.cancelled, 'success');
    } finally {
      cancellingRef.current = false;
      setCancellingId(null);
    }
  };

  if (isAuthLoading) {
    return <StorePageSkeleton label={t.common.loading} />;
  }

  if (!isAuthenticated) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="border-b border-[#2D1F1F]/8 bg-white">
          <div className={`${cx} py-10 sm:py-14`}>
            <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
              {t.returns.eyebrow}
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
              {t.returns.title}
            </h1>
          </div>
        </div>
        <div className={`${cx} py-16 sm:py-20`}>
          <div className="max-w-lg border border-[#2D1F1F]/8 rounded-xl p-8 text-center mx-auto">
            <Undo2 size={28} className="text-[#C9A84C] mx-auto mb-4" />
            <h2 className="text-lg font-serif text-[#2D1F1F] mb-2">
              {t.returns.signInTitle}
            </h2>
            <p className="text-sm text-[#2D1F1F]/50 leading-relaxed mb-6">
              {t.returns.signInBody}
            </p>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center px-6 bg-[#2D1F1F] text-white text-[10px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors"
            >
              {t.returns.signInCta}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.returns.eyebrow}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.returns.title}
          </h1>
          <p className="text-sm text-[#2D1F1F]/45 mt-3 max-w-xl leading-relaxed">
            {t.returns.subtitle}
          </p>
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        <div className="grid lg:grid-cols-[1fr_420px] gap-10 lg:gap-16">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50">
                {t.returns.yourRequests}
              </h2>
              <Link
                href="/account"
                className="hit-area text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
              >
                {t.returns.openOrders}
              </Link>
            </div>

            {needsBankAccountBanner ? (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50/60 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <Landmark size={18} className="text-amber-700 flex-shrink-0" aria-hidden />
                <p className="flex-1 text-sm text-amber-900 text-start">
                  {t.account.refundAddBankAccount.split('{amount}')[0]}
                  <bdi className="font-bold whitespace-nowrap">
                    {formatPrice(awaitingTransferAmount, 'OMR', language, t.common.omr)}
                  </bdi>
                  {t.account.refundAddBankAccount.split('{amount}')[1] ?? ''}
                </p>
                <Link
                  href={REFUND_ACCOUNT_HREF}
                  className="inline-flex h-10 items-center justify-center px-4 bg-[#2D1F1F] text-white text-[10px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors"
                >
                  {t.account.refundAddBankAccountAction}
                </Link>
              </div>
            ) : null}

            {listLoading ? (
              <ListSkeleton rows={3} label={t.common.loading} />
            ) : listError ? (
              <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-12 text-center">
                <p className="text-sm text-[#2D1F1F]/55 mb-4" role="alert">
                  {t.returns.loadError}
                </p>
                <button
                  type="button"
                  onClick={() => void loadLists()}
                  className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F]"
                >
                  {t.common.retry}
                </button>
              </div>
            ) : returns.length === 0 ? (
              <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-16 text-center">
                <Package
                  size={32}
                  strokeWidth={1}
                  className="text-[#2D1F1F]/15 mx-auto mb-4"
                />
                <p className="text-sm text-[#2D1F1F]/40">{t.returns.noReturns}</p>
              </div>
            ) : (
              <ul className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden divide-y divide-[#2D1F1F]/8">
                {returns.map((row) => {
                  const chip = returnStatusPresentation(row.status, t.returns);
                  const refund = refundStatusPresentation(
                    row.refundStatus,
                    t.returns,
                  );
                  return (
                    <li key={row.id} className="px-6 py-5">
                      <div
                        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                      >
                        <div className="flex gap-4 min-w-0">
                        {row.orderItem?.imageUrl ? (
                          <div className="relative w-14 h-14 overflow-hidden bg-[#F5F3EF] border border-[#2D1F1F]/8 rounded-md flex-shrink-0">
                            <Image
                              src={row.orderItem.imageUrl}
                              alt=""
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          </div>
                        ) : null}
                        <div className={`min-w-0 ${isRTL ? 'text-right' : ''}`}>
                          <p className="text-sm font-bold text-[#2D1F1F]">
                            {(row.orderItem
                              ? pickLocalized(
                                  language,
                                  row.orderItem.productName,
                                  row.orderItem.productNameAr,
                                )
                              : null) ??
                              `${t.returns.product} #${row.orderItem?.id ?? '—'}`}
                          </p>
                          {row.orderItem?.bundleName ? (
                            <p className="text-[11px] font-semibold text-[#C9A84C] mt-0.5">
                              {t.account.partOfBundle.replace(
                                '{name}',
                                pickLocalized(language, row.orderItem.bundleName, row.orderItem.bundleNameAr),
                              )}
                            </p>
                          ) : null}
                          <p className="text-xs text-[#2D1F1F]/45 mt-1">
                            {t.returns.requestedOn}:{' '}
                            {formatDate(row.createdAt, language)}
                          </p>
                          {row.subOrderNumber ? (
                            <p className="text-xs text-[#2D1F1F]/45 mt-0.5">
                              {t.returns.subOrder}: {row.subOrderNumber}
                            </p>
                          ) : null}
                          <p className="text-xs text-[#2D1F1F]/55 mt-2">
                            {t.returns.quantity}: {row.quantity}
                          </p>
                          <p className="text-sm text-[#2D1F1F] mt-2">
                            {localizedLabel(
                              row.reasonLabel,
                              row.reasonLabelAr,
                              language,
                            )}
                          </p>
                          {row.note ? (
                            <p className="text-xs text-[#2D1F1F]/45 mt-1">
                              {row.note}
                            </p>
                          ) : null}
                          {row.refundAmount != null ? (
                            <p className="text-xs text-[#2D1F1F]/55 mt-2">
                              {t.returns.refundAmount}:{' '}
                              <span className="text-sm font-bold text-emerald-700">
                                <bdi>
                                  {formatPrice(
                                    row.refundAmount,
                                    'OMR',
                                    language,
                                    t.common.omr,
                                  )}
                                </bdi>
                              </span>
                            </p>
                          ) : null}
                          {row.status === 'completed' && refund ? (
                            <p className={`text-xs font-semibold mt-1 ${refund.className}`}>
                              {refund.text}
                            </p>
                          ) : null}
                          {row.merchantNote ? (
                            <p className="text-xs text-[#2D1F1F]/55 mt-1">
                              {t.returns.merchantNote}: {row.merchantNote}
                            </p>
                          ) : null}
                        </div>
                        </div>
                        <div
                          className={`flex flex-col items-start sm:items-end gap-3 ${isRTL ? 'sm:items-start' : ''}`}
                        >
                          <span
                            className={`px-3 py-1 text-[10px] font-black tracking-[0.12em] uppercase rounded-md ${chip.bg} ${chip.text}`}
                          >
                            {chip.label}
                          </span>
                          {row.status === 'pending' ? (
                            <button
                              type="button"
                              disabled={cancellingId !== null}
                              onClick={() => setCancelTargetId(row.id)}
                              className="text-[10px] font-black tracking-[0.2em] uppercase text-red-500 hover:text-red-700 disabled:opacity-50"
                            >
                              {t.returns.cancelRequest}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {reasons ? (
              <p className="text-xs text-[#2D1F1F]/40 leading-relaxed">
                {reasons.returnWindowDays > 0
                  ? t.returns.eligibilityNote.replace(
                      '{days}',
                      String(reasons.returnWindowDays),
                    )
                  : t.returns.eligibilityNoLimit}
              </p>
            ) : null}
          </div>

          <div className="lg:sticky lg:top-24 self-start border border-[#2D1F1F]/8 rounded-xl p-6 sm:p-8">
            <div className="flex items-start gap-3 mb-6">
              <div className="w-11 h-11 flex items-center justify-center bg-[#C9A84C]/10 rounded-md flex-shrink-0">
                <Undo2 size={18} className="text-[#C9A84C]" />
              </div>
              <div>
                <h2 className="text-lg font-serif text-[#2D1F1F]">
                  {t.returns.createTitle}
                </h2>
                <p className="text-sm text-[#2D1F1F]/45 mt-1 leading-relaxed">
                  {t.returns.createHint}
                </p>
              </div>
            </div>

            <form onSubmit={(e) => void handleCreate(e)} noValidate>
              <div className="mb-4">
                <label htmlFor="return-order-item" className={labelClass}>
                  {t.returns.orderItemId}
                </label>
                {eligibleItems.length > 0 ? (
                  <select
                    id="return-order-item"
                    value={selectedEligible ? String(selectedEligible.itemId) : ''}
                    onChange={(e) => {
                      setOrderItemIdOverride(e.target.value);
                      setQuantity('1');
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.order_item_id;
                        delete next.quantity;
                        return next;
                      });
                    }}
                    disabled={submitting}
                    className={inputClass}
                  >
                    <option value="">
                      {t.returns.selectItem}
                    </option>
                    {eligibleItems.map((item) => (
                      <option key={item.itemId} value={item.itemId}>
                        {item.orderNumber} — {item.productName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p
                    id="return-order-item"
                    className="text-sm text-[#2D1F1F]/60 border border-dashed border-[#2D1F1F]/15 rounded-md px-4 py-3"
                  >
                    {listLoading ? t.common.loading : t.returns.noEligibleItems}
                  </p>
                )}
                <p className="mt-2 text-xs text-[#2D1F1F]/40">
                  {t.returns.orderItemIdHint}
                </p>
                {selectedEligible?.returnWindowEndsAt ? (
                  <p className="mt-1 text-xs text-[#2D1F1F]/55">
                    {t.returns.returnBy.replace(
                      '{date}',
                      formatDate(selectedEligible.returnWindowEndsAt, language),
                    )}
                  </p>
                ) : null}
                {fieldErrors.order_item_id ? (
                  <p className="mt-2 text-xs text-red-600" role="alert">
                    {fieldErrors.order_item_id}
                  </p>
                ) : null}
              </div>

              <div className="mb-4">
                <label htmlFor="return-quantity" className={labelClass}>
                  {t.returns.quantity}
                </label>
                <input
                  id="return-quantity"
                  type="number"
                  min={1}
                  max={selectedEligible?.maxQuantity}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={submitting || !selectedEligible}
                  className={inputClass}
                  dir="ltr"
                />
                {selectedEligible && selectedEligible.maxQuantity > 1 ? (
                  <p className="mt-2 text-xs text-[#2D1F1F]/40">
                    {t.returns.maxQuantity.replace(
                      '{count}',
                      String(selectedEligible.maxQuantity),
                    )}
                  </p>
                ) : null}
                {fieldErrors.quantity ? (
                  <p className="mt-2 text-xs text-red-600" role="alert">
                    {fieldErrors.quantity}
                  </p>
                ) : null}
              </div>

              <div className="mb-4">
                <label htmlFor="return-reason" className={labelClass}>
                  {t.returns.reason}
                </label>
                {reasonsError ? (
                  <p className="text-sm text-red-600" role="alert">
                    {t.returns.reasonsLoadError}
                  </p>
                ) : (
                  <select
                    id="return-reason"
                    value={selectedReason ? selectedReason.code : ''}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.reason;
                        delete next.note;
                        return next;
                      });
                    }}
                    disabled={submitting || reasons === null}
                    className={inputClass}
                  >
                    <option value="">{t.returns.selectReason}</option>
                    {reasons?.reasons.map((option) => (
                      <option key={option.code} value={option.code}>
                        {localizedLabel(option.label, option.labelAr, language)}
                      </option>
                    ))}
                  </select>
                )}
                {fieldErrors.reason ? (
                  <p className="mt-2 text-xs text-red-600" role="alert">
                    {fieldErrors.reason}
                  </p>
                ) : null}
              </div>

              <div className="mb-6">
                <label htmlFor="return-note" className={labelClass}>
                  {noteRequired ? t.returns.noteRequiredLabel : t.returns.note}
                </label>
                <textarea
                  id="return-note"
                  rows={3}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={submitting}
                  required={noteRequired}
                  aria-invalid={fieldErrors.note ? true : undefined}
                  placeholder={t.returns.notePlaceholder}
                  className="w-full px-4 py-3 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors resize-y"
                />
                {fieldErrors.note ? (
                  <p className="mt-2 text-xs text-red-600" role="alert">
                    {fieldErrors.note}
                  </p>
                ) : null}
              </div>

              {bankAccountState.status === 'ready' ? (
                <div className="mb-6 rounded-md border border-[#2D1F1F]/10 p-4">
                  <p className="flex items-start gap-2 text-xs text-[#2D1F1F]/70 leading-relaxed mb-3 text-start">
                    <Landmark size={14} className="text-[#C9A84C] flex-shrink-0 mt-0.5" aria-hidden />
                    {t.returns.bankTransferNote}
                  </p>
                  {savedBankAccount && !changeBankAccount ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#2D1F1F]">
                      <span>
                        {t.returns.refundGoesTo}:{' '}
                        <bdi dir="ltr" className="font-medium tracking-wide">
                          {maskIban(savedBankAccount.iban)}
                        </bdi>
                      </span>
                      <button
                        type="button"
                        onClick={() => setChangeBankAccount(true)}
                        disabled={submitting}
                        className="hit-area text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] disabled:opacity-50"
                      >
                        {t.returns.changeBankAccount}
                      </button>
                    </div>
                  ) : (
                    <>
                      <RefundAccountFields
                        idPrefix="return-refund"
                        iban={refundIban}
                        accountName={refundAccountName}
                        onIbanChange={(value) => {
                          setRefundIban(value);
                          clearBankErrors('refund_iban');
                        }}
                        onAccountNameChange={(value) => {
                          setRefundAccountName(value);
                          clearBankErrors('refund_account_name');
                        }}
                        errors={{
                          refund_iban: fieldErrors.refund_iban,
                          refund_account_name: fieldErrors.refund_account_name,
                        }}
                        disabled={submitting}
                        ibanMaxLength={REFUND_IBAN_INPUT_MAX}
                        nameMaxLength={REFUND_ACCOUNT_NAME_MAX}
                        placeholder={REFUND_IBAN_PLACEHOLDER}
                      />
                      {savedBankAccount ? (
                        <button
                          type="button"
                          onClick={() => {
                            setChangeBankAccount(false);
                            setRefundIban('');
                            setRefundAccountName('');
                            clearBankErrors('refund_iban');
                            clearBankErrors('refund_account_name');
                          }}
                          disabled={submitting}
                          className="hit-area mt-3 text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] disabled:opacity-50"
                        >
                          {t.returns.keepBankAccount}
                        </button>
                      ) : (
                        <p className="mt-3 text-[11px] text-[#2D1F1F]/45 text-start">
                          {t.returns.bankAccountLaterHint}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full h-11 bg-[#2D1F1F] text-white text-[10px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors disabled:opacity-60"
              >
                {submitting ? t.returns.submitting : t.returns.submit}
              </button>
            </form>
          </div>
        </div>
      </div>

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {cancelTargetId !== null ? (
                <motion.div
                  key="cancel-return-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                >
                  <div
                    className="absolute inset-0 bg-black/40"
                    onClick={closeCancelModal}
                    aria-hidden="true"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    className="relative z-10 w-full max-w-sm bg-white rounded-xl shadow-2xl max-h-[min(90vh,100%)] overflow-y-auto"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="cancel-return-title"
                    aria-describedby="cancel-return-desc"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-6">
                      <h2
                        id="cancel-return-title"
                        className="text-base font-serif font-bold text-[#2D1F1F] mb-2"
                      >
                        {t.returns.confirmCancelTitle}
                      </h2>
                      <p
                        id="cancel-return-desc"
                        className="text-sm text-[#2D1F1F]/50 mb-6 leading-relaxed"
                      >
                        {t.returns.confirmCancelDesc}
                      </p>
                      <div
                        className="flex gap-3"
                      >
                        <button
                          type="button"
                          onClick={() => void handleCancelConfirm()}
                          disabled={cancellingId !== null}
                          className="flex-1 h-11 bg-red-500 text-white text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-red-600 transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
                        >
                          {cancellingId !== null ? (
                            <Loader2
                              size={14}
                              className="animate-spin"
                              aria-hidden
                            />
                          ) : null}
                          {cancellingId !== null
                            ? t.returns.cancelling
                            : t.returns.confirmCancelAction}
                        </button>
                        <button
                          type="button"
                          onClick={closeCancelModal}
                          disabled={cancellingId !== null}
                          className="flex-1 h-11 border border-[#2D1F1F]/15 text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#FAF7F2] transition-colors disabled:opacity-40"
                        >
                          {t.returns.keepRequest}
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
