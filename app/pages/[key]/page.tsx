import type { Metadata } from 'next';
import CmsKeyPage, { generateCmsKeyMetadata } from '@/components/cms/CmsKeyPage';

type CmsPagesAliasProps = {
  params: Promise<{ key: string }>;
};

/** Backward-compatible alias for `/pages/{key}`. */
export async function generateMetadata({
  params,
}: CmsPagesAliasProps): Promise<Metadata> {
  const { key } = await params;
  return generateCmsKeyMetadata(key);
}

export default async function PagesAliasCmsPage({ params }: CmsPagesAliasProps) {
  const { key } = await params;
  return <CmsKeyPage cmsKey={key} />;
}
