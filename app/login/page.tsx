'use client';

import { useState, useRef, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { localizeAuthError } from '@/lib/auth/messages';
import { safeNextPath } from '@/lib/auth/next-path';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

const inputClass =
  'w-full h-12 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';

const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

const policyLinkClass =
  'font-semibold text-[#C9A84C] underline underline-offset-4 hover:text-[#2D1F1F] transition-colors';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { t, isRTL } = useLanguage();
  const { showToast } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [acceptPolicies, setAcceptPolicies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const policyCheckboxRef = useRef<HTMLInputElement>(null);

  const policyCopy = t.loginPolicy;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (isSubmitting) return;

    const trimmedEmail = email.trim();

    if (!trimmedEmail || password === '') {
      showToast(policyCopy.credentialsRequired, 'error');

      if (!trimmedEmail) {
        emailInputRef.current?.focus();
      } else {
        passwordInputRef.current?.focus();
      }

      return;
    }

    if (!acceptPolicies) {
      showToast(policyCopy.required, 'error');
      policyCheckboxRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    const result = await login(
      trimmedEmail,
      password,
      remember,
      acceptPolicies,
    );

    setIsSubmitting(false);

    if (result.success) {
      setAcceptPolicies(false);
      setPassword('');
      showToast(t.auth.welcomeBackToast, 'success');
      // Back where sign-in was asked for (e.g. the payment result page).
      const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
      router.push(next ?? '/account');
      return;
    }

    // Known messages (wrong password, rate limit, service down) are shown in
    // the UI language; other safe backend messages pass through.
    showToast(localizeAuthError(result.error ?? '', t, 'passthrough'), 'error');
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Page header */}
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.auth.welcomeBackEyebrow}
          </span>

          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.common.signIn}
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
            <form onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div className="mb-5">
                <label htmlFor="login-email" className={labelClass}>
                  {t.checkout.email}
                </label>

                <div className="relative">
                  <Mail
                    size={16}
                    className={`absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/30 pointer-events-none ${
                      isRTL ? 'right-4' : 'left-4'
                    }`}
                  />

                  <input
                    id="login-email"
                    ref={emailInputRef}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder={t.auth.emailPlaceholder}
                    className={`${inputClass} ${
                      isRTL
                        ? 'pr-11 pl-4 text-right'
                        : 'pl-11 pr-4'
                    }`}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="login-password"
                    className={`${labelClass} mb-0`}
                  >
                    {t.auth.password}
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-[10px] font-bold tracking-wide text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                  >
                    {t.auth.forgotPassword}
                  </Link>
                </div>

                <div className="relative">
                  <Lock
                    size={16}
                    className={`absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/30 pointer-events-none ${
                      isRTL ? 'right-4' : 'left-4'
                    }`}
                  />

                  <input
                    id="login-password"
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} ${
                      isRTL
                        ? 'pr-11 pl-11 text-right'
                        : 'pl-11 pr-11'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    className={`hit-area absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/40 hover:text-[#C9A84C] transition-colors ${
                      isRTL ? 'left-4' : 'right-4'
                    }`}
                    aria-label={
                      showPassword
                        ? t.common.hidePassword
                        : t.common.showPassword
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2.5 mb-5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={event => setRemember(event.target.checked)}
                  className="accent-[#C9A84C] w-4 h-4"
                />

                <span className="text-sm text-[#2D1F1F]/60">
                  {t.auth.rememberMe}
                </span>
              </label>

              {/* Policy acceptance is required for each manual login. */}
              <div className="flex items-start gap-2.5 mb-7">
                <input
                  id="login-policies"
                  ref={policyCheckboxRef}
                  type="checkbox"
                  checked={acceptPolicies}
                  onChange={event =>
                    setAcceptPolicies(event.target.checked)
                  }
                  required
                  disabled={isSubmitting}
                  className="mt-1 w-4 h-4 flex-shrink-0 accent-[#C9A84C]"
                />

                <label
                  htmlFor="login-policies"
                  className="text-sm leading-7 text-[#2D1F1F]/70 cursor-pointer"
                >
                  {policyCopy.prefix}{' '}

                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={policyLinkClass}
                  >
                    {policyCopy.terms}
                  </Link>

                  {' '}{policyCopy.and}{' '}

                  <Link
                    href="/returns-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={policyLinkClass}
                  >
                    {policyCopy.returns}
                  </Link>

                  {' '}{policyCopy.suffix}
                </label>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitting || !acceptPolicies}
                className="w-full h-12 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.25em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    {t.common.signIn}

                    <ArrowRight
                      size={14}
                      className={isRTL ? 'rtl-flip' : ''}
                    />
                  </>
                )}
              </motion.button>
            </form>

            <div className="flex items-center gap-2 mt-6 text-[11px] text-[#2D1F1F]/35">
              <ShieldCheck
                size={13}
                className="text-[#C9A84C] flex-shrink-0"
              />

              {t.common.infoSecure}
            </div>

            <div className="flex items-center gap-3 my-7">
              <div className="flex-1 h-px bg-[#2D1F1F]/8" />

              <span className="text-[10px] font-black tracking-[0.15em] uppercase text-[#2D1F1F]/30">
                {t.common.or}
              </span>

              <div className="flex-1 h-px bg-[#2D1F1F]/8" />
            </div>

            <p className="text-center text-sm text-[#2D1F1F]/55">
              {t.auth.dontHaveAccount}{' '}

              <Link
                href="/register"
                className="font-bold text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
              >
                {t.auth.createOne}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}