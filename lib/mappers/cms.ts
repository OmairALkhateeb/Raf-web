import 'server-only';

import type { CmsPageView, FaqItemView, LaravelCmsPageDto, LaravelFaqDto } from '@/types/api/cms';
import { sanitizeCmsHtml } from '@/lib/cms/sanitize';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value;
}

function finiteInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  return undefined;
}

/**
 * Parse a raw CMS page object. Returns null when the payload cannot be mapped
 * without fabricating a title or body.
 */
export function parseCmsPageDto(payload: unknown): LaravelCmsPageDto | null {
  const dto = asRecord(payload);
  if (!dto) return null;

  const id = finiteInt(dto.id);
  const key = asNonEmptyString(dto.key);
  const title = asNonEmptyString(dto.title);
  const content = asString(dto.content);
  const isPublished = asBoolean(dto.is_published);
  const createdAt = asNonEmptyString(dto.created_at);
  const updatedAt = asNonEmptyString(dto.updated_at);

  if (
    id === undefined ||
    !key ||
    !title ||
    content === undefined ||
    isPublished === undefined ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    key,
    title,
    title_ar: asNonEmptyString(dto.title_ar) ?? null,
    content,
    content_ar: asNonEmptyString(dto.content_ar) ?? null,
    is_published: isPublished,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function toCmsPageView(dto: LaravelCmsPageDto): CmsPageView {
  return {
    id: dto.id,
    key: dto.key,
    title: dto.title,
    titleAr: dto.title_ar,
    html: sanitizeCmsHtml(dto.content),
    htmlAr: dto.content_ar ? sanitizeCmsHtml(dto.content_ar) : null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function parseFaqDto(value: unknown): LaravelFaqDto | null {
  const dto = asRecord(value);
  if (!dto) return null;

  const id = finiteInt(dto.id);
  const question = asNonEmptyString(dto.question);
  const answer = asString(dto.answer);
  const sortOrder = finiteInt(dto.sort_order);
  const isActive = asBoolean(dto.is_active);
  const createdAt = asNonEmptyString(dto.created_at);
  const updatedAt = asNonEmptyString(dto.updated_at);

  if (
    id === undefined ||
    !question ||
    answer === undefined ||
    sortOrder === undefined ||
    isActive === undefined ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  if (dto.category !== null && typeof dto.category !== 'string') {
    return null;
  }

  const categoryRaw = typeof dto.category === 'string' ? dto.category.trim() : null;

  return {
    id,
    category: categoryRaw ? categoryRaw : null,
    question,
    question_ar: asNonEmptyString(dto.question_ar) ?? null,
    answer,
    answer_ar: asNonEmptyString(dto.answer_ar) ?? null,
    sort_order: sortOrder,
    is_active: isActive,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

/**
 * Skip unmappable FAQ rows rather than inventing questions or answers.
 * Inactive rows are dropped even if the API included them.
 */
export function toFaqItems(payload: unknown): FaqItemView[] | null {
  if (!Array.isArray(payload)) return null;

  const items: FaqItemView[] = [];

  for (const row of payload) {
    const dto = parseFaqDto(row);
    if (!dto) {
      console.error('[cms] skipped unmappable FAQ row', row);
      continue;
    }
    if (!dto.is_active) continue;

    items.push({
      id: dto.id,
      category: dto.category,
      categoryAr: typeof row === 'object' && row !== null && typeof (row as { category_ar?: unknown }).category_ar === 'string'
        ? ((row as { category_ar: string }).category_ar.trim() || null)
        : null,
      question: dto.question,
      questionAr: dto.question_ar,
      answer: dto.answer,
      answerAr: dto.answer_ar,
    });
  }

  return items;
}
