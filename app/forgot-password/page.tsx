'use client';

import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { postForgotPassword } from '@/lib/api/auth';
import {
  localizeForgotPasswordError,
  looksLikeEmail,
} from '@/lib/auth/password-reset';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';
const inputClass =
  'w-full h-12 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';
const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

export default function ForgotPasswordPage() {
  const { t, isRTL } = useLanguage();
  const { showToast } = useApp();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    const trimmed = email.trim();
    if (!looksLikeEmail(trimmed)) {
      setEmailError(t.home.newsletterInvalid);
      return;
    }

    setEmailError(null);
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await postForgotPassword(trimmed);
      if (result.ok) {
        setSent(true);
        showToast(t.auth.resetEmailSent, 'success');
        return;
      }

      showToast(localizeForgotPasswordError(result, t), 'error');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.auth.accountRecovery}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.auth.forgotPasswordTitle}
          </h1>
        </div>
      </div>

      <div className={`${cx} py-14 sm:py-20`}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-md mx-auto"
        >
          <div className="border border-[#2D1F1F]/8 rounded-xl p-8 sm:p-10">
            {sent ? (
              <div>
                <p className="text-sm text-[#2D1F1F]/70 leading-relaxed">
                  {t.auth.resetSentBody}
                </p>
                <p className="text-sm text-[#2D1F1F]/45 mt-4 leading-relaxed">
                  {t.auth.closeOrReturn}
                </p>
                <Link
                  href="/login"
                  className="mt-8 inline-flex items-center gap-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                >
                  <ArrowLeft size={14} className={isRTL ? 'rtl-flip' : ''} />
                  {t.auth.backToSignIn}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <p className="text-sm text-[#2D1F1F]/55 leading-relaxed mb-7">
                  {t.auth.enterEmailHint}
                </p>

                <div className="mb-7">
                  <label htmlFor="forgot-email" className={labelClass}>
                    {t.checkout.email}
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className={`absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/30 pointer-events-none ${isRTL ? 'right-4' : 'left-4'}`}
                    />
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      placeholder={t.auth.emailPlaceholder}
                      disabled={isSubmitting}
                      aria-invalid={emailError ? true : undefined}
                      aria-describedby={
                        emailError ? 'forgot-email-error' : undefined
                      }
                      className={`${inputClass} ${isRTL ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4'} disabled:opacity-60`}
                    />
                  </div>
                  {emailError ? (
                    <p
                      id="forgot-email-error"
                      className="mt-2 text-xs text-red-600"
                      role="alert"
                    >
                      {emailError}
                    </p>
                  ) : null}
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.25em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      {t.auth.sendResetLink}
                      <ArrowRight
                        size={14}
                        className={isRTL ? 'rtl-flip' : ''}
                      />
                    </>
                  )}
                </motion.button>
              </form>
            )}

            <div className="flex items-center gap-2 mt-6 text-[11px] text-[#2D1F1F]/35">
              <ShieldCheck
                size={13}
                className="text-[#C9A84C] flex-shrink-0"
              />
              {t.auth.wontConfirmAccount}
            </div>

            {!sent ? (
              <p className="text-center text-sm text-[#2D1F1F]/55 mt-7">
                <Link
                  href="/login"
                  className="font-bold text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                >
                  {t.auth.backToSignIn}
                </Link>
              </p>
            ) : null}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
