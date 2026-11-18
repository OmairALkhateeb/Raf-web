import type { Metadata } from 'next';
import CmsKeyPage, { generateCmsKeyMetadata } from '@/components/cms/CmsKeyPage';

type TopLevelCmsPageProps = {
  params: Promise<{ key: string }>;
};

/**
 * Clean CMS URLs such as `/footer_test` → GET /api/public/pages/footer_test.
 *
 * Static App Router segments (`/products`, `/brands`, `/account`, `/faq`,
 * `/about`, …) always take precedence. A CMS key that matches a reserved
 * storefront path cannot take over that route; pick another key or use the
 * `/pages/{key}` alias.
 */
export async function generateMetadata({
  params,
}: TopLevelCmsPageProps): Promise<Metadata> {
  const { key } = await params;
  return generateCmsKeyMetadata(key);
}

export default async function TopLevelCmsPage({ params }: TopLevelCmsPageProps) {
  const { key } = await params;
  return <CmsKeyPage cmsKey={key} />;
}
