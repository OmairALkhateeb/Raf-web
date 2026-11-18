import { parsePositiveIntString } from '@/lib/cart/ids';
import type { AccountProductQuestionStatus } from '@/types';

export type ProductQuestionCreateInput = {
  productId: number;
  question: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

/**
 * Accepts camelCase from the storefront client or snake_case.
 * Mirrors AskProductQuestionRequest: product_id required, question required max 1000.
 */
export function parseProductQuestionCreateBody(
  body: unknown,
): ProductQuestionCreateInput | null {
  const record = asObject(body);
  if (!record) return null;

  const productRaw =
    record.productId !== undefined ? record.productId : record.product_id;
  const productId =
    typeof productRaw === 'number'
      ? Number.isInteger(productRaw) && productRaw > 0
        ? productRaw
        : null
      : typeof productRaw === 'string'
        ? parsePositiveIntString(productRaw)
        : null;
  if (productId === null) return null;

  if (typeof record.question !== 'string') return null;
  const question = record.question.trim();
  if (!question || question.length > 1000) return null;

  return { productId, question };
}

export function parseProductIdParam(raw: string | null): number | null {
  if (!raw) return null;
  return parsePositiveIntString(raw);
}

type QuestionStatusLabels = {
  questionPending: string;
  questionAnswered: string;
  questionHidden: string;
};

export function productQuestionStatusPresentation(
  status: AccountProductQuestionStatus,
  labels: QuestionStatusLabels,
): { bg: string; text: string; label: string } {
  switch (status) {
    case 'pending':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        label: labels.questionPending,
      };
    case 'answered':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        label: labels.questionAnswered,
      };
    case 'hidden':
      return {
        bg: 'bg-[#2D1F1F]/5',
        text: 'text-[#2D1F1F]/55',
        label: labels.questionHidden,
      };
  }
}

/** Same-tab refresh hook when a question is created from the PDP modal. */
export const PRODUCT_QUESTIONS_CHANGED_EVENT = 'raf:product-questions-changed';

export function notifyProductQuestionsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PRODUCT_QUESTIONS_CHANGED_EVENT));
}
