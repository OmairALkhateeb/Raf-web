import 'server-only';

import { headers } from 'next/headers';
import type { Banner } from '@/types';
import type { BannerPlacementDto, PublicBannerDto } from '@/types/api/banner';
import { toPlacementBanners } from '@/lib/mappers/banner';
import { apiGet, isTransportFailure } from './http';

// Banners have start/end dates; a short cache keeps those edges accurate.
const BANNERS_REVALIDATE_SECONDS = 60;

/**
 * Active banners for one placement, already sorted by the backend.
 * `null` when the backend failed (callers may fall back); `[]` when none.
 */
export async function fetchPlacementBanners(
  placement: BannerPlacementDto,
  /** `category_page` only: that category's banners plus the general ones (#16). */
  categoryId?: number,
): Promise<Banner[] | null> {
  let payload: { data?: unknown };
  try {
    payload = await apiGet<{ data?: unknown }>(
      `/public/banners?placement=${placement}${categoryId !== undefined ? `&category_id=${categoryId}` : ''}`,
      { revalidate: BANNERS_REVALIDATE_SECONDS, tags: ['banners'] },
    );
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    console.error(`[banners] failed to load placement ${placement}`, error);
    return null;
  }

  const rows = Array.isArray(payload?.data) ? (payload.data as PublicBannerDto[]) : [];
  // Links to the store's own host become internal routes (no full reload).
  const host = (await headers()).get('host');
  return toPlacementBanners(rows, placement, host);
}
