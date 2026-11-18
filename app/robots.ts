import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/seo/site';

/** /robots.txt: shop pages are open; private and internal routes are not. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/account',
        '/cart',
        '/checkout',
        '/wishlist',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
