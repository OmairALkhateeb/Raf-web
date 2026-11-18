import type { Metadata } from 'next';
import CmsDocumentView from '@/components/cms/CmsDocumentView';
import CmsHtmlBody from '@/components/cms/CmsHtmlBody';
import { isSafeCmsPageKey } from '@/lib/cms/pageKey';
import { fetchDynamicCmsPage } from '@/lib/api/server/cms';
import { localizeCmsPage } from '@/lib/cms/localize';
import { getServerDictionary, getServerLanguage } from '@/lib/i18n/server';

export async function generateCmsKeyMetadata(key: string): Promise<Metadata> {
  const { language, t } = await getServerDictionary();
  if (!isSafeCmsPageKey(key)) return { title: t.meta.page };

  const result = await fetchDynamicCmsPage(key);
  if (result.status !== 'ok') return { title: t.meta.page };
  return { title: localizeCmsPage(result.page, language).title };
}

/** Shared renderer for `/pages/{key}` and top-level `/{key}`. */
export default async function CmsKeyPage({ cmsKey }: { cmsKey: string }) {
  if (!isSafeCmsPageKey(cmsKey)) {
    return <CmsDocumentView status="not-found" chrome="page" />;
  }

  const [result, language] = await Promise.all([
    fetchDynamicCmsPage(cmsKey),
    getServerLanguage(),
  ]);

  if (result.status === 'not-found') {
    return <CmsDocumentView status="not-found" chrome="page" />;
  }

  if (result.status !== 'ok') {
    return <CmsDocumentView status="unavailable" chrome="page" />;
  }

  const page = localizeCmsPage(result.page, language);

  return (
    <CmsDocumentView
      status="ok"
      chrome="page"
      title={page.title}
      updatedAt={result.page.updatedAt}
    >
      <CmsHtmlBody html={page.html} />
    </CmsDocumentView>
  );
}
