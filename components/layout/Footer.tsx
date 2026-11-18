'use client';

import { FormEvent, ReactNode, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Camera,
  Globe,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Play,
  Send,
  Users,
  X,
} from 'lucide-react';
import Logo from '@/components/common/Logo';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n/language';
import BannerSection from '@/components/home/BannerSection';
import { useApp } from '@/contexts/AppContext';
import { subscribeNewsletter } from '@/lib/actions/newsletter';
import { phoneFromTelHref } from '@/lib/contact/details';
import { contactIconKind, type ContactIconKind } from '@/lib/footer/contact';
import { footerGroupHeading, partitionFooterGroups } from '@/lib/footer/nav';
import { socialIconKind, type SocialIconKind } from '@/lib/footer/social';
import { FOOTER_GROUP_QUICK_LINKS } from '@/types/api/footer';
import type { FooterLinkDto, FooterLinkGroups } from '@/types/api/footer';
import type { Banner, Category } from '@/types';
import { safeHref, type SafeHref } from '@/utils/safeHref';

// The lists are spaced 12px apart, so the small touch area (6px up and down) never overlaps.
const linkClassName =
  'hit-area-sm inline-block text-[13px] text-white/35 hover:text-[#C9A84C] transition-colors break-words rounded-sm focus-visible:outline-none focus-visible:text-[#C9A84C] focus-visible:underline';

const socialButtonClassName =
  'w-9 h-9 border border-white/15 rounded-md flex items-center justify-center text-white/40 hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all duration-200 focus-visible:outline-none focus-visible:border-[#C9A84C] focus-visible:text-[#C9A84C]';

const contactLinkClassName =
  'hit-area-sm flex items-start gap-3 text-[13px] text-white/35 hover:text-[#C9A84C] transition-colors break-words rounded-sm focus-visible:outline-none focus-visible:text-[#C9A84C] focus-visible:underline';

const columnHeadingClassName =
  'text-[10px] font-black tracking-[0.3em] uppercase text-white/60 mb-5';

const LEGAL_PAGE_PATHS = new Set([
  '/terms',
  '/terms_of_service',
  '/pages/terms',
  '/pages/terms_of_service',
  '/returns-policy',
  '/returns_policy',
  '/pages/returns',
  '/pages/returns_policy',
  '/privacy',
  '/privacy_policy',
  '/pages/privacy',
  '/pages/privacy_policy',
]);

function isLegalPageLink(link: FooterLinkDto): boolean {
  const destination = safeHref(link.url);

  if (!destination || destination.kind !== 'internal') {
    return false;
  }

  const pathname = destination.href
    .split(/[?#]/, 1)[0]
    .replace(/\/+$/, '');

  return LEGAL_PAGE_PATHS.has(pathname);
}

function SocialGlyph({ kind }: { kind: SocialIconKind }) {
  const props = { size: 14, 'aria-hidden': true as const };

  switch (kind) {
    case 'instagram':
      return <Camera {...props} />;
    case 'whatsapp':
      return <MessageCircle {...props} />;
    case 'facebook':
      return <Users {...props} />;
    case 'twitter':
      return <X {...props} />;
    case 'linkedin':
      return <Briefcase {...props} />;
    case 'youtube':
      return <Play {...props} />;
    case 'telegram':
      return <Send {...props} />;
    default:
      return <Globe {...props} />;
  }
}

function FooterNavLink({ link }: { link: FooterLinkDto }) {
  const dest = safeHref(link.url);
  if (!dest) return null;

  let node: ReactNode;

  if (dest.kind === 'internal') {
    node = (
      <Link href={dest.href} className={linkClassName}>
        {link.label}
      </Link>
    );
  } else if (dest.kind === 'external') {
    node = (
      <a
        href={dest.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        {link.label}
      </a>
    );
  } else {
    node = (
      <a href={dest.href} className={linkClassName}>
        {link.label}
      </a>
    );
  }

  return <li>{node}</li>;
}

function FooterStoreLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <li>
      <Link href={href} className={linkClassName}>
        {children}
      </Link>
    </li>
  );
}

function socialLinkNode(
  dest: SafeHref,
  label: string,
  glyph: ReactNode,
) {
  if (dest.kind === 'external') {
    return (
      <a
        href={dest.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={socialButtonClassName}
      >
        {glyph}
      </a>
    );
  }

  if (dest.kind === 'internal') {
    return (
      <Link
        href={dest.href}
        aria-label={label}
        className={socialButtonClassName}
      >
        {glyph}
      </Link>
    );
  }

  return (
    <a
      href={dest.href}
      aria-label={label}
      className={socialButtonClassName}
    >
      {glyph}
    </a>
  );
}

function FooterSocialLink({ link }: { link: FooterLinkDto }) {
  const dest = safeHref(link.url);
  if (!dest) return null;

  return socialLinkNode(
    dest,
    link.label,
    <SocialGlyph kind={socialIconKind(dest)} />,
  );
}

function ContactGlyph({ kind }: { kind: ContactIconKind }) {
  const props = {
    size: 13,
    className: 'text-[#C9A84C] flex-shrink-0 mt-0.5',
    'aria-hidden': true as const,
  };

  switch (kind) {
    case 'phone':
      return <Phone {...props} />;
    case 'mail':
      return <Mail {...props} />;
    case 'map':
      return <MapPin {...props} />;
    default:
      return <Link2 {...props} />;
  }
}

function FooterContactLink({ link }: { link: FooterLinkDto }) {
  const dest = safeHref(link.url);
  if (!dest) return null;

  const glyph = <ContactGlyph kind={contactIconKind(dest)} />;
  // Phone links: the number next to the label, unless the label already is it.
  const phone = dest.kind === 'contact' ? phoneFromTelHref(dest.href) : null;
  const showPhone =
    phone !== null && link.label.replace(/\D/g, '') !== phone.replace(/\D/g, '');
  const label = showPhone ? (
    <span>
      {link.label}{' '}
      <bdi dir="ltr" className="text-white/60 whitespace-nowrap">
        {phone}
      </bdi>
    </span>
  ) : (
    link.label
  );
  let node: ReactNode;

  if (dest.kind === 'internal') {
    node = (
      <Link href={dest.href} className={contactLinkClassName}>
        {glyph}
        {label}
      </Link>
    );
  } else if (dest.kind === 'external') {
    node = (
      <a
        href={dest.href}
        target="_blank"
        rel="noopener noreferrer"
        className={contactLinkClassName}
      >
        {glyph}
        {label}
      </a>
    );
  } else {
    node = (
      <a href={dest.href} className={contactLinkClassName}>
        {glyph}
        {label}
      </a>
    );
  }

  return <li>{node}</li>;
}

function FooterLinkColumn({
  heading,
  links,
}: {
  heading: string;
  links: FooterLinkDto[];
}) {
  if (links.length === 0) return null;

  return (
    <div className="min-w-0">
      <h4 className={columnHeadingClassName}>{heading}</h4>

      <ul className="space-y-3">
        {links.map(link => (
          <FooterNavLink key={link.id} link={link} />
        ))}
      </ul>
    </div>
  );
}

interface FooterProps {
  categories: Category[];
  footerGroups: FooterLinkGroups;
  /** For the copyright line; from the server so it matches after hydration. */
  year: number;
  /** `placement=footer` banners, shown above the footer. */
  banners?: Banner[];
}

export default function Footer({
  banners = [],
  categories,
  footerGroups,
  year,
}: FooterProps) {
  const { language, t, isRTL } = useLanguage();
  const { showToast } = useApp();
  const [email, setEmail] = useState('');
  const [isPending, startTransition] = useTransition();

  // Labels in the UI language (Arabic falls back to English) before grouping.
  const localizedGroups = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(footerGroups).map(([group, links]) => [
          group,
          links.map((link) => ({
            ...link,
            label: pickLocalized(language, link.label, link.label_ar),
          })),
        ]),
      ),
    [footerGroups, language],
  );
  const { customerService, socialLinks, contactLinks, extraGroups } =
    partitionFooterGroups(localizedGroups);

  const customerServiceLinks = customerService.filter(
    link => !isLegalPageLink(link),
  );

  const handleSubscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    startTransition(async () => {
      const result = await subscribeNewsletter(email);

      if (result.status === 'success') {
        showToast(t.home.newsletterSuccess, 'success');
        setEmail('');
        return;
      }

      if (result.status === 'validation') {
        showToast(result.message || t.home.newsletterInvalid, 'error');
        return;
      }

      showToast(t.home.newsletterUnavailable, 'error');
    });
  };

  return (
    <>
    <BannerSection banners={banners} compact tone="dark" ratio="24/5" />
    <footer
      className="bg-[#1A1210] text-[#E8D5A3]"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Newsletter strip */}
      <div className="border-b border-white/8">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-16">
          <div className="max-w-xl mx-auto text-center">
            <span className="text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-4 block">
              {t.common.stayConnected}
            </span>

            <h3 className="text-2xl sm:text-3xl font-serif text-white mb-3">
              {t.home.newsletter}
            </h3>

            <p className="text-sm text-white/40 mb-8 leading-relaxed">
              {t.home.newsletterDesc}
            </p>

            {/*
              Keep the button on the visual right in both languages.
              Physical corner rounding preserves the flush input/button seam.
            */}
            <form
              onSubmit={handleSubscribe}
              className={`flex gap-0 max-w-md mx-auto ${
                isRTL ? 'flex-row-reverse' : ''
              }`}
            >
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder={t.home.emailPlaceholder}
                autoComplete="email"
                required
                disabled={isPending}
                className={`flex-1 min-w-0 h-12 bg-white border border-white/15 text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 focus:outline-none focus:border-[#C9A84C] transition-colors rounded-l-md disabled:opacity-60 ${
                  isRTL ? 'pr-4 text-right' : 'pl-4'
                }`}
              />

              <button
                type="submit"
                disabled={isPending}
                className="h-12 px-7 bg-[#C9A84C] text-[#2D1F1F] text-[11px] font-black tracking-widest uppercase rounded-r-md hover:bg-white transition-colors duration-200 whitespace-nowrap flex-shrink-0 disabled:opacity-60 disabled:hover:bg-[#C9A84C]"
              >
                {t.home.subscribeBtn}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-16 lg:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16 xl:gap-20 min-w-0">
          <div className="min-w-0">
            <Logo variant="light" size="md" />

            <p className="mt-5 text-[13px] text-white/35 leading-relaxed">
              {t.footer.tagline}
            </p>

            {socialLinks.length > 0 ? (
              <div
                className="flex flex-wrap gap-2.5 mt-6"
                role="group"
                aria-label={t.footer.followUs}
              >
                {socialLinks.map(link => (
                  <FooterSocialLink key={link.id} link={link} />
                ))}
              </div>
            ) : null}

            {contactLinks.length > 0 ? (
              <ul className="mt-7 space-y-3">
                {contactLinks.map(link => (
                  <FooterContactLink key={link.id} link={link} />
                ))}
              </ul>
            ) : null}
          </div>

          <div className="min-w-0">
            <h4 className={columnHeadingClassName}>
              {t.nav.allCategories}
            </h4>

            <ul className="space-y-3">
              {categories.map(cat => (
                <li key={cat.id}>
                  <Link
                    href={`/products?category=${encodeURIComponent(cat.slug)}`}
                    className={linkClassName}
                  >
                    {(language === 'ar' ? cat.nameAr : cat.name) ??
                      cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <h4 className={columnHeadingClassName}>
              {t.footer.mainLinks}
            </h4>

            <ul className="space-y-3">
              <FooterStoreLink href="/">
                {t.nav.home}
              </FooterStoreLink>

              <FooterStoreLink href="/products">
                {t.nav.products}
              </FooterStoreLink>

              <FooterStoreLink href="/brands">
                {t.nav.brands}
              </FooterStoreLink>

              <FooterStoreLink href="/about">
                {t.nav.about}
              </FooterStoreLink>

              <FooterStoreLink href="/account">
                {t.footer.myAccount}
              </FooterStoreLink>

              <FooterStoreLink href="/wishlist">
                {t.nav.wishlist}
              </FooterStoreLink>
            </ul>
          </div>

          <div className="min-w-0">
            <h4 className={columnHeadingClassName}>
              {t.footer.customerService}
            </h4>

            <ul className="space-y-3">
              {customerServiceLinks.map(link => (
                <FooterNavLink key={link.id} link={link} />
              ))}

              <FooterStoreLink href="/terms">
                {t.footer.customerTerms}
              </FooterStoreLink>

              <FooterStoreLink href="/returns-policy">
                {t.footer.returnsPolicy}
              </FooterStoreLink>

              <FooterStoreLink href="/privacy">
                {t.footer.privacy}
              </FooterStoreLink>

              {/* A plain link: `/delete-account` redirects to the backend's own page. */}
              <li>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a route handler that redirects off-site, not a page */}
                <a href="/delete-account" className={linkClassName}>
                  {t.footer.deleteAccount}
                </a>
              </li>
            </ul>
          </div>

          {extraGroups.map(({ group, links }) => (
            <FooterLinkColumn
              key={group}
              heading={
                group === FOOTER_GROUP_QUICK_LINKS
                  ? t.footer.quickLinks
                  : footerGroupHeading(group)
              }
              links={links.filter(link => !isLegalPageLink(link))}
            />
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/8">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-5 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="text-[11px] text-white/25 tracking-wide">
            {t.footer.rights.replace('{year}', String(year))}
          </span>

          <a
            href="https://axiscore.de/"
            target="_blank"
            rel="noopener noreferrer"
            className="hit-area-sm group flex items-center gap-1.5 text-[11px] text-white/25 tracking-wide hover:text-white/45 transition-colors focus-visible:outline-none focus-visible:text-white/45"
          >
            {t.common.poweredBy}

            <span className="font-bold tracking-[0.15em] uppercase latin-tracking text-[#C9A84C] group-hover:text-white transition-colors">
              AxisCore
            </span>
          </a>
        </div>
      </div>
    </footer>
    </>
  );
}