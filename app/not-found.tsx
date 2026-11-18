import Link from 'next/link';
import { getServerDictionary } from '@/lib/i18n/server';
import { languageDirection } from '@/lib/i18n/language';

/**
 * Every URL no route matches (e.g. `/orders/10` instead of `/account/orders/10`).
 * Without it Next.js shows its built-in page, whose text turns white in dark
 * mode and disappears on the store's cream background.
 */
export default async function NotFound() {
  const { language, t } = await getServerDictionary();

  const linkClass =
    'inline-flex items-center justify-center h-12 px-8 rounded-md text-[11px] font-black tracking-[0.25em] uppercase transition-colors duration-300';

  return (
    <div className="bg-[#FAF7F2]" dir={languageDirection(language)}>
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-28 sm:py-36 text-center">
        <p className="text-6xl sm:text-7xl font-serif text-[#C9A84C]/80 mb-6" dir="ltr">
          404
        </p>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2D1F1F] mb-3">
          {t.notFound.title}
        </h1>
        <p className="text-sm text-[#2D1F1F]/55 max-w-md mx-auto leading-relaxed">
          {t.notFound.hint}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/" className={`${linkClass} bg-[#2D1F1F] text-white hover:bg-[#C9A84C]`}>
            {t.notFound.home}
          </Link>
          <Link
            href="/products"
            className={`${linkClass} border border-[#2D1F1F]/20 text-[#2D1F1F] hover:border-[#C9A84C] hover:text-[#C9A84C]`}
          >
            {t.notFound.products}
          </Link>
          <Link
            href="/account"
            className={`${linkClass} border border-[#2D1F1F]/20 text-[#2D1F1F] hover:border-[#C9A84C] hover:text-[#C9A84C]`}
          >
            {t.notFound.orders}
          </Link>
        </div>
      </div>
    </div>
  );
}
