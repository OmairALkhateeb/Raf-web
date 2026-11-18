import type { Metadata } from 'next';
import CmsDocumentView from '@/components/cms/CmsDocumentView';
import CmsHtmlBody from '@/components/cms/CmsHtmlBody';
import { fetchCmsPage } from '@/lib/api/server/cms';
import { localizeCmsPage } from '@/lib/cms/localize';
import { getServerDictionary, getServerLanguage } from '@/lib/i18n/server';

const CMS_KEY = 'about' as const;

export async function generateMetadata(): Promise<Metadata> {
  const [result, { language, t }] = await Promise.all([
    fetchCmsPage(CMS_KEY),
    getServerDictionary(),
  ]);
  if (result.status !== 'ok') return { title: t.meta.about };
  return { title: localizeCmsPage(result.page, language).title };
}

export default async function AboutPage() {
  const [result, language] = await Promise.all([
    fetchCmsPage(CMS_KEY),
    getServerLanguage(),
  ]);

  if (result.status === 'not-found') {
    return <CmsDocumentView status="not-found" chrome="about" />;
  }

  if (result.status !== 'ok') {
    return <CmsDocumentView status="unavailable" chrome="about" />;
  }

  const page = localizeCmsPage(result.page, language);

  return (
    <CmsDocumentView
      status="ok"
      chrome="about"
      title={page.title}
      updatedAt={result.page.updatedAt}
    >
      <CmsHtmlBody html={page.html} />
    </CmsDocumentView>
  );
}
