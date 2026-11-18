/**
 * Transport types for GET /api/public/footer-links and
 * POST /api/public/newsletter/subscribe.
 *
 * Footer-links is either an empty JSON array `[]` or an object grouped by the
 * `group` field. Timestamps are present on the resource but unused in the UI.
 */

export interface FooterLinkDto {
  id: number;
  group: string;
  label: string;
  /** Arabic label; `null` until an admin writes it. */
  label_ar?: string | null;
  url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type FooterLinkGroups = Record<string, FooterLinkDto[]>;

export const FOOTER_GROUP_QUICK_LINKS = 'quick_links';
export const FOOTER_GROUP_CUSTOMER_SERVICE = 'customer_service';
export const FOOTER_GROUP_SOCIAL_LINKS = 'social_links';
export const FOOTER_GROUP_CONTACT_LINKS = 'contact_links';

export interface NewsletterSubscribeRequest {
  email: string;
}

export interface NewsletterSubscribeSuccess {
  message: string;
}

export interface LaravelValidationError {
  message?: string;
  errors?: Record<string, string[]>;
}
