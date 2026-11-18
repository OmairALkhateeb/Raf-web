import 'server-only';

import { fetchCmsPage } from '@/lib/api/server/cms';
import type { CmsPageView } from '@/types/api/cms';

/**
 * Terms and Returns Policy: the admin-editable CMS page once an admin has
 * edited it, otherwise the built-in legal text.
 *
 * The backend seeds both pages with a one-sentence placeholder
 * (`updated_at` = `created_at`). Showing that instead of the full policy would
 * drop the legal text, so the CMS page only takes over after its first edit
 * in the admin panel.
 */
export async function fetchEditedLegalPage(key: 'terms' | 'returns'): Promise<CmsPageView | null> {
  const result = await fetchCmsPage(key);
  if (result.status !== 'ok') return null;
  const created = Date.parse(result.page.createdAt);
  const updated = Date.parse(result.page.updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated)) return null;
  return updated > created ? result.page : null;
}
