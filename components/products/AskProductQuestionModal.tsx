'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { createProductQuestion } from '@/lib/api/account';
import { localizeProductQuestionError } from '@/lib/account/messages';
import { notifyProductQuestionsChanged } from '@/lib/account/product-questions';

const inputClass =
  'w-full px-4 py-3 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors resize-y';
const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

type AskProductQuestionModalProps = {
  open: boolean;
  productId: number;
  productName: string;
  onClose: () => void;
  onUnauthenticated: () => void;
};

export default function AskProductQuestionModal({
  open,
  productId,
  productName,
  onClose,
  onUnauthenticated,
}: AskProductQuestionModalProps) {
  const { t, isRTL } = useLanguage();
  const { showToast } = useApp();
  const [question, setQuestion] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const resetForm = useCallback(() => {
    setQuestion('');
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
    const trimmed = question.trim();
    const nextErrors: Record<string, string> = {};
    if (!trimmed) {
      nextErrors.question = t.product.questionRequired;
    } else if (trimmed.length > 1000) {
      nextErrors.question = t.product.questionTooLong;
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await createProductQuestion({
        productId,
        question: trimmed,
      });
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          onUnauthenticated();
          return;
        }
        if (result.fields) {
          setFieldErrors(result.fields);
        }
        showToast(localizeProductQuestionError(result, t), 'error');
        return;
      }
      showToast(t.product.questionCreated, 'success');
      resetForm();
      onClose();
      notifyProductQuestionsChanged();
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
          key="ask-product-question-overlay"
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
            aria-labelledby="ask-product-question-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8">
              <h2
                id="ask-product-question-title"
                className="text-lg font-serif text-[#2D1F1F] mb-1"
              >
                {t.product.askQuestionFormTitle}
              </h2>
              <p className="text-sm text-[#2D1F1F]/45 mb-2 leading-relaxed">
                {productName}
              </p>
              <p className="text-sm text-[#2D1F1F]/45 mb-6 leading-relaxed">
                {t.product.askQuestionFormHint}
              </p>

              <form onSubmit={(e) => void handleSubmit(e)} noValidate>
                <div className="mb-6">
                  <label htmlFor="ask-product-question" className={labelClass}>
                    {t.product.askQuestionLabel}
                  </label>
                  <textarea
                    id="ask-product-question"
                    rows={4}
                    maxLength={1000}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={submitting}
                    placeholder={t.product.askQuestionPlaceholder}
                    className={inputClass}
                  />
                  {fieldErrors.question ? (
                    <p className="mt-2 text-xs text-red-600" role="alert">
                      {fieldErrors.question}
                    </p>
                  ) : null}
                  {fieldErrors.product_id ? (
                    <p className="mt-2 text-xs text-red-600" role="alert">
                      {fieldErrors.product_id}
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
                      ? t.product.submittingQuestion
                      : t.product.submitQuestion}
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    disabled={submitting}
                    className="flex-1 h-11 border border-[#2D1F1F]/15 text-[#2D1F1F] text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#FAF7F2] transition-colors disabled:opacity-40"
                  >
                    {t.product.closeQuestionForm}
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
