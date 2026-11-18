'use client';

import { useState, type FormEvent } from 'react';
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { pickLocalized } from '@/lib/i18n/language';
import type { ContactDetails } from '@/lib/contact/details';
import { sendContactMessage } from '@/lib/actions/contact';
import {
  CONTACT_LIMITS,
  validateContact,
  type ContactField,
  type ContactFieldErrors,
} from '@/lib/contact/validate';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';
const inputClass = 'w-full h-11 px-4 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';
const labelClass = 'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-2 text-xs text-red-600" role="alert">
      {message}
    </p>
  );
}

export default function ContactView({ details }: { details: ContactDetails }) {
  const { language, t, isRTL } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  // Signed-in customers: the name starts from the account (still editable,
  // `null` = not edited yet) and the email is the account's, locked.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const accountEmail = isAuthenticated && user?.email ? user.email : null;
  const values = {
    name: nameDraft ?? (isAuthenticated ? user?.name ?? '' : form.name),
    email: accountEmail ?? form.email,
    subject: form.subject,
    message: form.message,
  };
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: ContactField, value: string) => {
    if (field === 'name' && isAuthenticated) setNameDraft(value);
    else setForm(f => ({ ...f, [field]: value }));
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const fieldMessage = (field: ContactField): string | null => {
    switch (errors[field]) {
      case 'required':
        return {
          name: t.contact.nameRequired,
          email: t.contact.emailRequired,
          subject: t.contact.subjectRequired,
          message: t.contact.messageRequired,
        }[field];
      case 'too_long':
        return {
          name: t.contact.nameTooLong,
          email: t.contact.emailTooLong,
          subject: t.contact.subjectTooLong,
          message: t.contact.messageTooLong,
        }[field];
      case 'invalid_email':
        return t.contact.emailInvalid;
      default:
        return null;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    setFormError(null);

    const clientErrors = validateContact(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSending(true);
    try {
      const result = await sendContactMessage(values);
      switch (result.status) {
        case 'success':
          setSubmitted(true);
          break;
        case 'validation':
          setErrors(result.fields);
          if (Object.keys(result.fields).length === 0) {
            setFormError(t.common.checkDetails);
          }
          break;
        case 'rate_limited':
          setFormError(
            result.retryAfter
              ? t.common.tooManyAttemptsWait.replace(
                  '{seconds}',
                  String(result.retryAfter),
                )
              : t.common.tooManyAttempts,
          );
          break;
        default:
          setFormError(t.contact.sendError);
      }
    } catch {
      setFormError(t.contact.sendError);
    } finally {
      setSending(false);
    }
  };

  // The admin's footer contact links first, then the official details.
  const phone = details.phone ?? {
    display: t.contact.phoneValue,
    href: `tel:${t.contact.phoneValue.replace(/[^\d+]/g, '')}`,
  };
  const email = details.email ?? {
    display: t.contact.emailValue,
    href: `mailto:${t.contact.emailValue}`,
  };
  const address = details.address
    ? {
        display: pickLocalized(language, details.address.label, details.address.labelAr),
        href: details.address.href,
      }
    : {
        display: t.contact.addressValue,
        href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          t.contact.addressValue,
        )}`,
      };

  const infoCards: {
    Icon: typeof Phone;
    title: string;
    value: string;
    href?: string;
    ltr?: boolean;
  }[] = [
    { Icon: Phone, title: t.checkout.phone, value: phone.display, href: phone.href, ltr: true },
    { Icon: Mail, title: t.checkout.email, value: email.display, href: email.href, ltr: true },
    { Icon: MapPin, title: t.contact.addressTitle, value: address.display, href: address.href },
    { Icon: Clock, title: t.contact.hoursTitle, value: t.contact.hoursValue },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Page header */}
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.contact.eyebrow}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.nav.contact}
          </h1>
          <p className="text-sm text-[#2D1F1F]/45 mt-3 max-w-xl leading-relaxed">
            {t.contact.intro}
          </p>
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        <div className="grid lg:grid-cols-[1fr_420px] gap-10 lg:gap-16">
          {/* Form */}
          <div className="border border-[#2D1F1F]/8 rounded-xl p-8">
            <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-[#2D1F1F]/50 mb-7">
              {t.contact.sendMessage}
            </h2>

            {submitted ? (
              <div className="text-center py-16">
                <CheckCircle2 size={40} strokeWidth={1.2} className="text-[#C9A84C] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#2D1F1F] mb-2">
                  {t.contact.messageSent}
                </h3>
                <p className="text-sm text-[#2D1F1F]/50 leading-relaxed max-w-sm mx-auto">
                  {t.contact.thankYou}
                </p>
              </div>
            ) : (
              <form
                onSubmit={e => void handleSubmit(e)}
                noValidate
                className="space-y-5"
              >
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="contact-name" className={labelClass}>{t.checkout.fullName}</label>
                    <input
                      id="contact-name"
                      type="text"
                      value={values.name}
                      onChange={e => update('name', e.target.value)}
                      placeholder={t.contact.yourName}
                      maxLength={CONTACT_LIMITS.name}
                      autoComplete="name"
                      required
                      aria-invalid={errors.name ? true : undefined}
                      disabled={sending}
                      className={inputClass}
                    />
                    <FieldError message={fieldMessage('name')} />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className={labelClass}>{t.checkout.email}</label>
                    <input
                      id="contact-email"
                      type="email"
                      value={values.email}
                      onChange={e => update('email', e.target.value)}
                      placeholder={t.auth.emailPlaceholder}
                      maxLength={CONTACT_LIMITS.email}
                      autoComplete="email"
                      dir="ltr"
                      required
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={accountEmail ? 'contact-email-hint' : undefined}
                      disabled={sending || accountEmail !== null}
                      className={`${inputClass} disabled:opacity-70 disabled:cursor-not-allowed`}
                    />
                    {accountEmail ? (
                      <p id="contact-email-hint" className="mt-2 text-xs text-[#2D1F1F]/45">
                        {t.contact.emailFromAccount}
                      </p>
                    ) : null}
                    <FieldError message={fieldMessage('email')} />
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-subject" className={labelClass}>{t.contact.subject}</label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={form.subject}
                    onChange={e => update('subject', e.target.value)}
                    placeholder={t.contact.subjectPlaceholder}
                    maxLength={CONTACT_LIMITS.subject}
                    required
                    aria-invalid={errors.subject ? true : undefined}
                    disabled={sending}
                    className={inputClass}
                  />
                  <FieldError message={fieldMessage('subject')} />
                </div>
                <div>
                  <label htmlFor="contact-message" className={labelClass}>{t.contact.message}</label>
                  <textarea
                    id="contact-message"
                    value={form.message}
                    onChange={e => update('message', e.target.value)}
                    rows={6}
                    placeholder={t.contact.messagePlaceholder}
                    maxLength={CONTACT_LIMITS.message}
                    required
                    aria-invalid={errors.message ? true : undefined}
                    disabled={sending}
                    className="w-full px-4 py-3 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors resize-y min-h-[140px]"
                  />
                  <FieldError message={fieldMessage('message')} />
                </div>
                {formError ? (
                  <p className="text-sm text-red-600" role="alert">
                    {formError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={sending}
                  className="flex items-center justify-center gap-2.5 h-12 px-8 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.25em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors disabled:opacity-60"
                >
                  {sending ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  ) : (
                    <Send size={14} className={isRTL ? 'rtl-flip' : ''} />
                  )}
                  {sending ? t.contact.sending : t.contact.send}
                </button>
              </form>
            )}
          </div>

          {/* Info cards */}
          <div className="space-y-5">
            {infoCards.map(({ Icon, title, value, href, ltr }, i) => (
              <div key={i} className="border border-[#2D1F1F]/8 rounded-xl p-6 flex items-start gap-4">
                <div className="w-11 h-11 flex items-center justify-center bg-[#C9A84C]/10 rounded-md flex-shrink-0">
                  <Icon size={18} className="text-[#C9A84C]" />
                </div>
                <div>
                  <h3 className="text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-1">
                    {title}
                  </h3>
                  {href ? (
                    <a
                      href={href}
                      {...(href.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      dir={ltr ? 'ltr' : undefined}
                      className="hit-area inline-block text-sm font-bold text-[#2D1F1F] hover:text-[#C9A84C] transition-colors break-words"
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="text-sm font-bold text-[#2D1F1F]">{value}</p>
                  )}
                </div>
              </div>
            ))}

            <a
              href={address.href}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden h-48 bg-[#FAF7F2] flex items-center justify-center hover:border-[#C9A84C] transition-colors"
            >
              <div className="text-center px-6">
                <MapPin size={24} className="text-[#C9A84C] mx-auto mb-2" />
                <p className="text-xs text-[#2D1F1F]/50">{address.display}</p>
                <p className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] mt-2">
                  {t.contact.openMap}
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
