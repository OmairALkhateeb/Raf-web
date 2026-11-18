import { AccountPageSkeleton } from '@/components/common/Loading';
import { getServerDictionary } from '@/lib/i18n/server';

/** Shown the moment an account page is opened, until its code has arrived. */
export default async function AccountLoading() {
  const { t } = await getServerDictionary();
  return <AccountPageSkeleton label={t.common.loading} />;
}
