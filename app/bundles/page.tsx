import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerDictionary } from '@/lib/i18n/server';
import { fetchBundlesPage } from '@/lib/api/server/bundles';
import BundleCard from '@/components/bundles/BundleCard';

const PER_PAGE = 12;
const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

type BundlesPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDictionary();
  return { title: t.bundles.title, description: t.bundles.subtitle };
}

function pageHref(page: number, gift: boolean): string {
  const params = new URLSearchParams();
  if (gift) params.set('type', 'gift');
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/bundles?${query}` : '/bundles';
}

export default async function BundlesPage({ searchParams }: BundlesPageProps) {
  const [raw, { language, t }] = await Promise.all([searchParams, getServerDictionary()]);
  const pageRaw = typeof raw.page === 'string' ? raw.page : '1';
  const page = /^\d{1,4}$/.test(pageRaw) && Number(pageRaw) > 0 ? Number(pageRaw) : 1;
  const gift = raw.type === 'gift';

  const result = await fetchBundlesPage({ page, perPage: PER_PAGE, giftSetsOnly: gift });
  const tab = (active: boolean) =>
    `h-10 px-5 inline-flex items-center text-[11px] font-bold tracking-[0.12em] uppercase border rounded-md transition-colors ${
      active ? 'border-[#2D1F1F] bg-[#2D1F1F] text-white' : 'border-[#2D1F1F]/20 text-[#2D1F1F]/70 hover:border-[#2D1F1F]/50'
    }`;

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.bundles.eyebrow}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">{t.bundles.title}</h1>
          <p className="text-sm text-[#2D1F1F]/50 mt-3">{t.bundles.subtitle}</p>
          <div className="flex gap-2.5 mt-6">
            <Link href={pageHref(1, false)} className={tab(!gift)}>{t.bundles.all}</Link>
            <Link href={pageHref(1, true)} className={tab(gift)}>{t.bundles.giftSets}</Link>
          </div>
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        {!result ? (
          <p className="text-center text-sm text-[#2D1F1F]/55 py-16" role="alert">{t.bundles.unavailable}</p>
        ) : result.bundles.length === 0 ? (
          <p className="text-center text-sm text-[#2D1F1F]/45 py-16">{t.bundles.empty}</p>
        ) : (
          <>
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {result.bundles.map((bundle) => (
                <BundleCard key={bundle.id} bundle={bundle} />
              ))}
            </div>
            {result.lastPage > 1 ? (
              <nav className="flex items-center justify-center gap-4 mt-10" aria-label={t.catalog.pagination}>
                {result.currentPage > 1 ? (
                  <Link href={pageHref(result.currentPage - 1, gift)} className="text-[11px] font-black tracking-[0.2em] uppercase text-[#C9A84C]">
                    {t.catalog.previousPage}
                  </Link>
                ) : null}
                <span className="text-sm text-[#2D1F1F]/50" dir="ltr">
                  {result.currentPage} / {result.lastPage}
                </span>
                {result.currentPage < result.lastPage ? (
                  <Link href={pageHref(result.currentPage + 1, gift)} className="text-[11px] font-black tracking-[0.2em] uppercase text-[#C9A84C]">
                    {t.catalog.nextPage}
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
