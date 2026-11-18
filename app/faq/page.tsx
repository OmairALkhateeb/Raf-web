import type { Metadata } from 'next';
import { getServerDictionary } from '@/lib/i18n/server';
import FaqView from '@/components/cms/FaqView';
import { fetchFaqs } from '@/lib/api/server/cms';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDictionary();
  return { title: t.meta.faq };
}

export default async function FaqPage() {
  const result = await fetchFaqs();

  if (result.status !== 'ok') {
    return <FaqView status="unavailable" items={[]} />;
  }

  if (result.items.length === 0) {
    return <FaqView status="empty" items={[]} />;
  }

  return <FaqView status="ok" items={result.items} />;
}
