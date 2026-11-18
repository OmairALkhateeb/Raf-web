import { StorePageSkeleton } from '@/components/common/Loading';
import { getServerDictionary } from '@/lib/i18n/server';

export default async function CheckoutLoading() {
  const { t } = await getServerDictionary();
  return <StorePageSkeleton label={t.common.loading} />;
}
