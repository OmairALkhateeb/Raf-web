import 'server-only';

import type {
  AccountProductQuestion,
  AccountProductQuestionStatus,
  AccountProductQuestionsMeta,
} from '@/types';
import type { ProductQuestionCreateFields } from '@/types/api/account';
import { firstValidationMessage } from '@/lib/mappers/auth';

const QUESTION_STATUSES: readonly AccountProductQuestionStatus[] = [
  'pending',
  'answered',
  'hidden',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function positiveInt(value: unknown): number | undefined {
  const n = finiteNumber(value);
  if (n === undefined || !Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function nonNegativeInt(value: unknown): number | undefined {
  const n = finiteNumber(value);
  if (n === undefined || !Number.isInteger(n) || n < 0) return undefined;
  return n;
}

function pageNumber(value: unknown): number | undefined {
  const n = nonNegativeInt(value);
  if (n === undefined) return undefined;
  return n < 1 ? 1 : n;
}

function unwrapLaravelData(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record) return payload;
  if ('data' in record) return record.data;
  return payload;
}

function isQuestionStatus(
  value: unknown,
): value is AccountProductQuestionStatus {
  return (
    typeof value === 'string' &&
    (QUESTION_STATUSES as readonly string[]).includes(value)
  );
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string =>
      typeof entry === 'string' && entry.trim().length > 0,
  );
}

/**
 * Customer index eager-loads `product:id,name` so `product_name` is usually present.
 * POST create does not load `product`/`customer`, so those fields may be omitted.
 * Resource never returns product images or merchant details.
 */
export function parseLaravelProductQuestion(
  raw: unknown,
): AccountProductQuestion | undefined {
  const dto = asRecord(unwrapLaravelData(raw));
  if (!dto) return undefined;

  const id = positiveInt(dto.id);
  const productId = positiveInt(dto.product_id);
  const question = asNonEmptyString(dto.question);
  const createdAt = asNonEmptyString(dto.created_at);
  if (
    id === undefined ||
    productId === undefined ||
    !question ||
    !createdAt ||
    !isQuestionStatus(dto.status)
  ) {
    return undefined;
  }

  const productName =
    dto.product_name === undefined
      ? null
      : asNullableString(dto.product_name);
  if (productName === undefined) return undefined;

  const customerName =
    dto.customer_name === undefined
      ? null
      : asNullableString(dto.customer_name);
  if (customerName === undefined) return undefined;

  const answer = asNullableString(dto.answer);
  if (answer === undefined) return undefined;

  const answeredAt = asNullableString(dto.answered_at);
  if (answeredAt === undefined) return undefined;

  return {
    id,
    productId,
    productName,
    customerName,
    question,
    answer,
    answeredAt,
    status: dto.status,
    createdAt,
  };
}

export function parseLaravelProductQuestionsPage(
  raw: unknown,
):
  | {
      questions: AccountProductQuestion[];
      meta: AccountProductQuestionsMeta;
    }
  | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;

  const data = Array.isArray(record.data)
    ? record.data
    : unwrapLaravelData(raw);
  if (!Array.isArray(data)) return undefined;

  const metaRaw = asRecord(record.meta);
  const currentPage = metaRaw ? pageNumber(metaRaw.current_page) : undefined;
  const lastPage = metaRaw ? pageNumber(metaRaw.last_page) : undefined;
  const perPage = metaRaw ? positiveInt(metaRaw.per_page) : undefined;
  const total = metaRaw ? nonNegativeInt(metaRaw.total) : undefined;
  if (
    currentPage === undefined ||
    lastPage === undefined ||
    perPage === undefined ||
    total === undefined
  ) {
    return undefined;
  }

  const questions: AccountProductQuestion[] = [];
  for (const entry of data) {
    const row = parseLaravelProductQuestion(entry);
    if (!row) {
      console.error('Laravel product-question row could not be mapped');
      continue;
    }
    questions.push(row);
  }

  return {
    questions,
    meta: { currentPage, lastPage, perPage, total },
  };
}

export function parseProductQuestionCreateFields(
  body: unknown,
): ProductQuestionCreateFields {
  const record = asRecord(body);
  const errors = record ? asRecord(record.errors) : null;
  if (!errors) return {};

  const fields: ProductQuestionCreateFields = {};
  for (const key of ['product_id', 'question'] as const) {
    const messages = stringArray(errors[key]);
    if (messages[0]) fields[key] = messages[0];
  }
  return fields;
}

export function productQuestionValidationMessage(
  body: unknown,
): string | undefined {
  const fields = parseProductQuestionCreateFields(body);
  const firstField = Object.values(fields).find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return firstField ?? firstValidationMessage(body);
}
