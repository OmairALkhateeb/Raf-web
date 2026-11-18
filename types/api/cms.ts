/**
 * Transport types for public CMS endpoints.
 *
 * GET /api/public/pages/{key} and GET /api/public/faqs return raw JSON
 * (a page object or a FAQ array), not a `{ data: ... }` envelope.
 *
 * Pages and FAQs carry both languages: `title` / `title_ar`,
 * `content` / `content_ar`, `question` / `question_ar`, `answer` / `answer_ar`.
 * The Arabic fields are `null` until an admin writes them. FAQ `category` has
 * no Arabic.
 */

export interface LaravelCmsPageDto {
  id: number;
  key: string;
  title: string;
  title_ar: string | null;
  content: string;
  content_ar: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface LaravelFaqDto {
  id: number;
  category: string | null;
  question: string;
  question_ar: string | null;
  answer: string;
  answer_ar: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Keys the backend uses (lowercase; its lookup ignores case). `about` isn't
 * created in the backend yet, so /about shows the not-published state until an
 * admin adds it under CMS Pages.
 */
export type CmsPageKey = 'privacy' | 'terms' | 'shipping' | 'returns' | 'about';

/** Sanitized CMS page ready for the storefront. */
export interface CmsPageView {
  id: number;
  key: string;
  title: string;
  titleAr: string | null;
  html: string;
  /** Sanitized `content_ar`; `null` when there is no Arabic version. */
  htmlAr: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FaqItemView {
  id: number;
  category: string | null;
  /** Since 08/10/2026 (#25). */
  categoryAr: string | null;
  question: string;
  questionAr: string | null;
  answer: string;
  answerAr: string | null;
}
