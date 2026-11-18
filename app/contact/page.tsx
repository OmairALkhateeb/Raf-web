import type { Metadata } from 'next';
import ContactView from '@/components/contact/ContactView';
import { fetchFooterLinks } from '@/lib/api/server/footer';
import { contactDetailsFromLinks } from '@/lib/contact/details';
import { getServerDictionary } from '@/lib/i18n/server';
import { FOOTER_GROUP_CONTACT_LINKS } from '@/types/api/footer';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerDictionary();
  return { title: t.meta.contact };
}

export default async function ContactPage() {
  // Same admin-managed links as the footer's contact column.
  const groups = await fetchFooterLinks();
  const details = contactDetailsFromLinks(groups?.[FOOTER_GROUP_CONTACT_LINKS]);
  return <ContactView details={details} />;
}
