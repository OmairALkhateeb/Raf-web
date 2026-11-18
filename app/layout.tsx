import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileMenu from "@/components/layout/MobileMenu";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import ToastContainer from "@/components/common/Toast";
import { fetchBrands, fetchCategories } from "@/lib/api/server/catalog";
import { fetchFooterLinks } from "@/lib/api/server/footer";
import { fetchPlacementBanners } from "@/lib/api/server/banners";
import { toCatalogBrand, toCatalogCategory } from "@/lib/mappers/catalog";
import { headers } from "next/headers";
import { getServerDictionary } from "@/lib/i18n/server";
import { languageDirection } from "@/lib/i18n/language";
import { buildAlternates, PATH_HEADER } from "@/lib/seo/alternates";
import { siteOrigin } from "@/lib/seo/site";

// Self-hosted via next/font/local. The variable-weight woff2 files live in
// app/fonts (OFL licensed, see LICENSE-*.txt there). They are committed rather
// than pulled through next/font/google because that fetches from Google Fonts
// at build time, and a failed fetch on the build server fails the whole deploy.
//
// Cairo covers both Latin and Arabic, so it doubles as the universal fallback
// for any element whose primary font (Inter or Playfair) lacks the glyphs
// being rendered — this is what stops Arabic headings from falling back to
// the browser's default serif (Times New Roman).
const cairo = localFont({
  src: "./fonts/cairo-wght.woff2",
  weight: "200 1000",
  style: "normal",
  variable: "--font-cairo",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-latin-wght.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
});

const playfair = localFont({
  src: "./fonts/playfair-display-latin-wght.woff2",
  weight: "400 900",
  style: "normal",
  variable: "--font-playfair",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export async function generateMetadata(): Promise<Metadata> {
  const [{ language, t }, origin, requestHeaders] = await Promise.all([
    getServerDictionary(),
    siteOrigin(),
    headers(),
  ]);
  // Canonical + hreflang for the requested page (`proxy.ts` passes the path).
  // Private pages (cart, account…) are `noindex` in their own layouts.
  const alternates = buildAlternates(requestHeaders.get(PATH_HEADER) ?? "/", language);
  return {
    metadataBase: new URL(origin),
    alternates,
    robots: { index: true, follow: true },
    title: {
      default: t.meta.siteTitle,
      template: "%s | RAF",
    },
    description: t.meta.siteDescription,
    keywords: ["Oman", "beauty", "makeup", "perfumes", "skincare", "lashes", "nails", "beauty devices", "health and nutrition", "gifts", "Amouage"],
    authors: [{ name: "RAF" }],
    creator: "RAF",
    openGraph: {
      type: "website",
      locale: language === "ar" ? "ar_OM" : "en_OM",
      alternateLocale: language === "ar" ? "en_OM" : "ar_OM",
      // No title/description here: shared links then use each page's own.
      siteName: "RAF",
      url: alternates.canonical,
      images: [{ url: "/images/logo.png", alt: "RAF" }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categoryDtos, brandDtos, footerGroups, { language }, footerBanners] = await Promise.all([
    fetchCategories(),
    fetchBrands(),
    fetchFooterLinks(),
    getServerDictionary(),
    fetchPlacementBanners("footer"),
  ]);
  const categories = categoryDtos ? categoryDtos.map(toCatalogCategory) : [];
  const brands = brandDtos ? brandDtos.map(toCatalogBrand) : [];

  return (
    <html
      lang={language}
      dir={languageDirection(language)}
      className={`h-full ${cairo.variable} ${inter.variable} ${playfair.variable}`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF7F2] font-sans">
        <LanguageProvider initialLanguage={language}>
          <AuthProvider>
       
          <CartProvider>
            <WishlistProvider>
              <AppProvider>
              <NotificationsProvider>
                <Header categories={categories} brands={brands} />
                <MobileMenu categories={categories} />
                <main className="flex-1 page-transition">
                  {children}
                </main>
                <Footer
                  categories={categories}
                  footerGroups={footerGroups ?? {}}
                  banners={footerBanners ?? []}
                  year={new Date().getFullYear()}
                />
                {/* Spacer so the fixed mobile bottom nav never covers the footer */}
                <div className="h-16 lg:hidden" aria-hidden="true" />
                <MobileBottomNav />
                <ToastContainer />
              </NotificationsProvider>
              </AppProvider>
            </WishlistProvider>
          </CartProvider>
     
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
