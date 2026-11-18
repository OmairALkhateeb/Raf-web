import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getServerDictionary } from '@/lib/i18n/server';
import JsonLd from '@/components/seo/JsonLd';
import { currentAlternates, openGraphFor, organizationJsonLd, websiteJsonLd } from '@/lib/seo/metadata';
import { siteOrigin } from '@/lib/seo/site';
import HeroCarousel from '@/components/home/HeroCarousel';
import CategoryGrid from '@/components/home/CategoryGrid';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import BrandShowcase from '@/components/home/BrandShowcase';
import HomeUnavailable from '@/components/home/HomeUnavailable';
import { fetchHomeData } from '@/lib/api/server/home';
import { fetchPlacementBanners } from '@/lib/api/server/banners';
import BannerSection from '@/components/home/BannerSection';
import BundlesSection from '@/components/bundles/BundlesSection';
import { toBundles } from '@/lib/mappers/bundle';
import { toBrand } from '@/lib/mappers/brand';
import {
  toBanners,
  toBestsellers,
  toCategory,
  toNewArrivals,
  toPinnedProducts,
} from '@/lib/mappers/home';
import { ar } from '@/utils/locales/ar';
import { en } from '@/utils/locales/en';

export async function generateMetadata(): Promise<Metadata> {
  const { language, t } = await getServerDictionary();
  const { canonical } = await currentAlternates(language);
  return {
    title: { absolute: t.meta.siteTitle },
    openGraph: openGraphFor(language, canonical, {
      title: t.meta.siteTitle,
      description: t.meta.siteShortDescription,
      images: [{ url: '/images/logo.png', alt: 'RAF' }],
    }),
  };
}

/** One row of cards, matching the grid's widest breakpoint. */
const STRIP_SIZE = 5;

export default async function HomePage() {
  // Mapping runs outside the service's error handling on purpose: only remote
  // failures produce the unavailable state, mapping bugs stay visible.
  const [data, heroFromApi, promotionBanners, origin, { language, t }] = await Promise.all([
    fetchHomeData(),
    fetchPlacementBanners('homepage_hero'),
    fetchPlacementBanners('promotion'),
    siteOrigin(),
    getServerDictionary(),
  ]);

  // The home payload's hero_banners has the same shape; it's the fallback.
  const heroBanners =
    heroFromApi ??
    (data ? toBanners(data.hero_banners, (await headers()).get('host')) : []);
  const promotions = promotionBanners ?? [];
  const bundles = data ? toBundles(data.bundles) : [];
  const categories = data ? data.featured_categories.map(toCategory) : [];
  const brands = data ? data.featured_brands.map(dto => toBrand(dto)) : [];
  const pinnedProducts = data ? toPinnedProducts(data.pinned_products).slice(0, STRIP_SIZE) : [];
  const bestsellers = data ? toBestsellers(data.bestsellers).slice(0, STRIP_SIZE) : [];
  const newArrivals = data ? toNewArrivals(data.new_arrivals).slice(0, STRIP_SIZE) : [];

  const hasContent =
    heroBanners.length > 0 ||
    promotions.length > 0 ||
    bundles.length > 0 ||
    categories.length > 0 ||
    brands.length > 0 ||
    pinnedProducts.length > 0 ||
    bestsellers.length > 0 ||
    newArrivals.length > 0;

  if (!hasContent) {
    return <HomeUnavailable />;
  }

  return (
    <div>
      <JsonLd data={[organizationJsonLd(origin), websiteJsonLd(origin, language, t.meta.siteTitle)]} />
      {heroBanners.length > 0 && <HeroCarousel banners={heroBanners} />}

      {/* Primary gateway: shop by category */}
      {categories.length > 0 && <CategoryGrid categories={categories} />}

      {/* Admin promotions (placement=promotion); hidden when there are none. */}
      <BannerSection banners={promotions} />

      <BundlesSection bundles={bundles} />

      {/* Shop by brand */}
      {brands.length > 0 && <BrandShowcase brands={brands} />}

      {pinnedProducts.length > 0 && (
        <FeaturedProducts
          products={pinnedProducts}
          label={en.home.curated}
          labelAr={ar.home.curated}
          title={en.home.featuredPicks}
          titleAr={ar.home.featuredPicks}
        />
      )}

      {bestsellers.length > 0 && (
        <FeaturedProducts
          products={bestsellers}
          label={en.home.mostLoved}
          labelAr={ar.home.mostLoved}
          title={en.home.bestsellers}
          titleAr={ar.home.bestsellers}
          subtitle={en.home.bestsellersSubtitle}
          subtitleAr={ar.home.bestsellersSubtitle}
          viewAllHref="/products?sort=bestselling"
          dark
        />
      )}

      {newArrivals.length > 0 && (
        <FeaturedProducts
          products={newArrivals}
          label={en.home.justIn}
          labelAr={ar.home.justIn}
          title={en.home.newArrivalsTitle}
          titleAr={ar.home.newArrivalsTitle}
          viewAllHref="/products?sort=newest"
        />
      )}
    </div>
  );
}
