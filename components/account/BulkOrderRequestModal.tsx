'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { createBulkOrderRequest } from '@/lib/api/account';
import { localizeBulkOrderError } from '@/lib/account/messages';
import { notifyBulkOrdersChanged } from '@/lib/account/bulk-orders';
import type { ProductDetailVariant } from '@/types';

const inputClass =
  'w-full h-11 px-4 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';
const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

type BulkOrderRequestModalProps = {
  open: boolean;
  productId: number;
  productName: string;
  variants: ProductDetailVariant[];
  onClose: () => void;
  onUnauthenticated: () => void;
  onCreated?: () => void;
};

export default function BulkOrderRequestModal({
  open,
  productId,
  productName,
  variants,
  onClose,
  onUnauthenticated,
  onCreated,
}: BulkOrderRequestModalProps) {
  const { t, isRTL } = useLanguage();
  const { showToast } = useApp();
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [variantId, setVariantId] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const resetForm = useCallback(() => {
    setQuantity('1');
    setNote('');
    setVariantId('');
    setFieldErrors({});
  }, []);

  const close = useCallback(() => {
    if (submittingRef.current) return;
    onClose();
    resetForm();
  }, [onClose, resetForm]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, close]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || submitting) return;

    setFieldErrors({});
    const qty = Number(quantity.trim());
    const nextErrors: Record<string, string> = {};
    if (!Number.isInteger(qty) || qty < 1) {
      nextErrors.quantity = t.account.bulkQuantityInvalid;
    }
    if (note.trim().length > 2000) {
      nextErrors.note = t.account.bulkNoteTooLong;
    }
    let parsedVariant: number | null = null;
    if (variantId.trim()) {
      const v = Number(variantId);
      if (!Number.isInteger(v) || v < 1) {
        nextErrors.variant_id = t.account.bulkVariantInvalid;
      } else {
        parsedVariant = v;
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await createBulkOrderRequest({
        productId,
        variantId: parsedVariant,
        quantity: qty,
        note: note.trim() ? note.trim() : null,
      });
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          onUnauthenticated();
          return;
        }
        if (result.fields) {
          setFieldErrors(result.fields);
        }
        showToast(localizeBulkOrderError(result, t), 'error');
        return;
      }
      showToast(t.account.bulkCreated, 'success');
      resetForm();
      onClose();
      notifyBulkOrdersChanged();
      onCreated?.();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="bulk-order-request-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={close}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            dir={isRTL ? 'rtl' : 'ltr'}
            className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl max-h-[min(90vh,100%)] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-order-request-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8">
              <h2
                id="bulk-order-request-title"
                className="text-lg font-serif text-[#2D1F1F] mb-1"
              >
                {t.account.bulkFormTitle}
              </h2>
              <p className="text-sm text-[#2D1F1F]/45 mb-2 leading-relaxed">
                {productName}
              </p>
              <p className="text-sm text-[#2D1F1F]/45 mb-6 leading-relaxed">
                {t.account.bulkFormHint}
              </p>

              <form onSubmit={(e) => void handleSubmit(e)} noValidate>
                {variants.length > 0 ? (
                  <div className="mb-4">
                    <label htmlFor="bulk-variant" className={labelClass}>
                      {t.account.bulkVariant}
                    </label>
                    <select
                      id="bulk-variant"
                      value={variantId}
                      onChange={(e) => setVariantId(e.target.value)}
                      disabled={submitting}
                      className={inputClass}
                    >
                      <option value="">{t.account.bulkNoVariant}</option>
                      {variants.map((v) => (
                        <option key={v.id} value={String(v.id)}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.variant_id ? (
                      <p className="mt-2 text-xs text-red-600" role="alert">
                        {fieldErrors.variant_id}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mb-4">
                  <label htmlFor="bulk-quantity" className={labelClass}>
                    {t.account.bulkQuantity}
                  </label>
                  <input
                    id="bulk-quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={submitting}
                    className={inputClass}
                  />
                  {fieldErrors.quantity ? (
                    <p className="mt-2 text-xs text-red-600" role="alert">
                      {fieldErrors.quantity}
                    </p>
                  ) : null}
                  {fieldErrors.product_id ? (
                    <p className="mt-2 text-xs text-red-600" role="alert">
                      {fieldErrors.product_id}
                    </p>
                  ) : null}
                </div>

                <div className="mb-6">
                  <label htmlFor="bulk-note" className={labelClass}>
                    {t.account.bulkNote}
                  </label>
                  <textarea
                    id="bulk-note"
                    rows={3}
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={submitting}
                    placeholder={t.account.bulkNotePlaceholder}
                    className="w-full px-4 py-3 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors resize-y"
                  />
                  {fieldErrors.note ? (
                    <p className="mt-2 text-xs text-red-600" role="alert">
                      {fieldErrors.note}
                    </p>
                  ) : null}
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-11 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                        aria-hidden
                      />
                    ) : null}
                    {submitting
                      ? t.account.bulkSubmitting
                      : t.account.bulkSubmit}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    disabled={submitting}
                    className="flex-1 h-11 border border-[#2D1F1F]/15 text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#FAF7F2] transition-colors disabled:opacity-40"
                  >
                    {t.account.bulkCloseForm}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
