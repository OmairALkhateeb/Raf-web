import type { Metadata } from 'next';
import { getServerDictionary } from '@/lib/i18n/server';
import { NOINDEX } from '@/lib/seo/metadata';

/** Private page: its own title, never in search results. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDictionary();
  return { title: t.account.wishlist, robots: NOINDEX };
}

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
