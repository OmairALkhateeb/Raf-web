import type { Language } from '@/types';
import type { CmsPageView } from '@/types/api/cms';

/**
 * The page's title and body in the UI language. Arabic falls back to English
 * when the admin hasn't written the Arabic version yet.
 */
export function localizeCmsPage(
  page: CmsPageView,
  language: Language,
): { title: string; html: string } {
  if (language === 'ar') {
    return {
      title: page.titleAr ?? page.title,
      html: page.htmlAr ?? page.html,
    };
  }
  return { title: page.title, html: page.html };
}
