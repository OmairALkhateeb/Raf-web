'use client';

import { FormEvent, Suspense, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { postResetPassword } from '@/lib/api/auth';
import { passwordMeetsPolicy } from '@/lib/auth/password';
import {
  localizeResetPasswordError,
  localizeResetPasswordField,
  looksLikeEmail,
} from '@/lib/auth/password-reset';
import type { ResetPasswordFields } from '@/types/api/auth';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';
const inputClass =
  'w-full h-12 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';
const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, isRTL } = useLanguage();
  const { showToast } = useApp();

  const token = useMemo(
    () => (searchParams.get('token') ?? '').trim(),
    [searchParams],
  );
  const email = useMemo(
    () => (searchParams.get('email') ?? '').trim(),
    [searchParams],
  );

  const linkValid = token !== '' && looksLikeEmail(email);

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ResetPasswordFields>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!linkValid || submittingRef.current || isSubmitting) return;

    const nextErrors: ResetPasswordFields = {};
    if (!passwordMeetsPolicy(password)) {
      nextErrors.password = 'policy';
    }
    if (password !== passwordConfirmation) {
      nextErrors.password_confirmation = 'mismatch';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await postResetPassword({
        email,
        token,
        password,
        passwordConfirmation,
      });

      if (result.ok) {
        setPassword('');
        setPasswordConfirmation('');
        showToast(t.auth.passwordResetSuccess, 'success');
        router.push('/login');
        return;
      }

      setFieldErrors(result.fields ?? {});
      showToast(localizeResetPasswordError(result, t), 'error');
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
            {t.auth.resetPasswordTitle}
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
            {!linkValid ? (
              <div>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 flex items-center justify-center bg-red-50 rounded-md flex-shrink-0">
                    <ShieldAlert size={18} className="text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-serif text-[#2D1F1F]">
                      {t.auth.invalidResetLink}
                    </h2>
                    <p className="text-sm text-[#2D1F1F]/55 mt-2 leading-relaxed">
                      {t.auth.invalidResetBody}
                    </p>
                  </div>
                </div>
                <div className="mt-8 flex flex-col gap-3">
                  <Link
                    href="/forgot-password"
                    className="inline-flex items-center justify-center h-12 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.25em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors"
                  >
                    {t.auth.requestNewLink}
                  </Link>
                  <Link
                    href="/login"
                    className="text-center text-sm font-bold text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                  >
                    {t.auth.backToSignIn}
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <p className="text-sm text-[#2D1F1F]/55 leading-relaxed mb-7">
                  {t.auth.resetFormHint}
                </p>

                <div className="mb-5">
                  <label htmlFor="reset-password" className={labelClass}>
                    {t.account.newPassword}
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className={`absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/30 pointer-events-none ${isRTL ? 'right-4' : 'left-4'}`}
                    />
                    <input
                      id="reset-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.password;
                            return next;
                          });
                        }
                      }}
                      placeholder="••••••••"
                      disabled={isSubmitting}
                      aria-invalid={fieldErrors.password ? true : undefined}
                      className={`${inputClass} ${isRTL ? 'pr-11 pl-11 text-right' : 'pl-11 pr-11'} disabled:opacity-60`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className={`hit-area absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/40 hover:text-[#C9A84C] transition-colors ${isRTL ? 'left-4' : 'right-4'}`}
                      aria-label={
                        showPassword
                          ? t.common.hidePassword
                          : t.common.showPassword
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p className="mt-2 text-xs text-red-600" role="alert">
                      {localizeResetPasswordField(fieldErrors.password, t)}
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] text-[#2D1F1F]/40">
                      {t.auth.passwordPolicy}
                    </p>
                  )}
                </div>

                <div className="mb-7">
                  <label
                    htmlFor="reset-password-confirm"
                    className={labelClass}
                  >
                    {t.account.confirmNewPassword}
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className={`absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/30 pointer-events-none ${isRTL ? 'right-4' : 'left-4'}`}
                    />
                    <input
                      id="reset-password-confirm"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passwordConfirmation}
                      onChange={(e) => {
                        setPasswordConfirmation(e.target.value);
                        if (fieldErrors.password_confirmation) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.password_confirmation;
                            return next;
                          });
                        }
                      }}
                      placeholder="••••••••"
                      disabled={isSubmitting}
                      aria-invalid={
                        fieldErrors.password_confirmation ? true : undefined
                      }
                      className={`${inputClass} ${isRTL ? 'pr-11 pl-11 text-right' : 'pl-11 pr-11'} disabled:opacity-60`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className={`hit-area absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/40 hover:text-[#C9A84C] transition-colors ${isRTL ? 'left-4' : 'right-4'}`}
                      aria-label={
                        showConfirm
                          ? t.common.hidePassword
                          : t.common.showPassword
                      }
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password_confirmation ? (
                    <p className="mt-2 text-xs text-red-600" role="alert">
                      {localizeResetPasswordField(
                        fieldErrors.password_confirmation,
                        t,
                      )}
                    </p>
                  ) : null}
                  {fieldErrors.token ? (
                    <p className="mt-2 text-xs text-red-600" role="alert">
                      {localizeResetPasswordField(fieldErrors.token, t)}
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
                      {t.auth.resetPasswordTitle}
                      <ArrowRight
                        size={14}
                        className={isRTL ? 'rtl-flip' : ''}
                      />
                    </>
                  )}
                </motion.button>

                <p className="text-center text-sm text-[#2D1F1F]/55 mt-7">
                  <Link
                    href="/forgot-password"
                    className="font-bold text-[#C9A84C] hover:text-[#2D1F1F] transition-colors"
                  >
                    {t.auth.requestNewLink}
                  </Link>
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className={`${cx} py-32 text-center`}>
          <Loader2
            size={20}
            className="animate-spin text-[#C9A84C] mx-auto"
          />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
