'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import AccountSidebar from '@/components/account/AccountSidebar';
import EmailVerificationCard from '@/components/account/EmailVerificationCard';
import PhoneVerificationCard from '@/components/account/PhoneVerificationCard';
import { postChangePassword } from '@/lib/api/auth';
import { passwordMeetsPolicy } from '@/lib/auth/password';
import {
  localizePasswordChangeError,
  localizePasswordChangeField,
} from '@/lib/auth/password-change';
import type { PasswordChangeFields } from '@/types/api/auth';
import DeleteAccountCard from '@/components/account/DeleteAccountCard';
import { AccountPageSkeleton } from '@/components/common/Loading';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';
const inputClass =
  'w-full h-11 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';
const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

export default function AccountSettingsPage() {
  const { t, isRTL } = useLanguage();
  const { showToast } = useApp();
  const router = useRouter();
  const { user, isAuthenticated, isAuthLoading, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<PasswordChangeFields>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    showToast(t.common.signedOut, 'success');
    router.push('/');
  };

  const handleSessionLost = async () => {
    await logout();
    router.replace('/login');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    setFieldErrors({});

    if (!currentPassword || !password || !passwordConfirmation) {
      setFieldErrors({ current_password: 'required' });
      showToast(localizePasswordChangeField('required', t), 'error');
      return;
    }

    if (password !== passwordConfirmation) {
      setFieldErrors({ password_confirmation: 'mismatch' });
      showToast(localizePasswordChangeField('mismatch', t), 'error');
      return;
    }

    if (!passwordMeetsPolicy(password)) {
      setFieldErrors({ password: 'policy' });
      showToast(localizePasswordChangeField('policy', t), 'error');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await postChangePassword({
        currentPassword,
        password,
        passwordConfirmation,
      });

      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await handleSessionLost();
          return;
        }
        setFieldErrors(result.fields ?? {});
        showToast(localizePasswordChangeError(result, t), 'error');
        return;
      }

      setCurrentPassword('');
      setPassword('');
      setPasswordConfirmation('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setFieldErrors({});
      showToast(t.account.passwordChanged, 'success');
    } catch (error) {
      console.error(
        'Password change failed',
        error instanceof Error ? error.name : 'unknown',
      );
      showToast(
        localizePasswordChangeError(
          { ok: false, code: 'unavailable' },
          t,
        ),
        'error',
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || !isAuthenticated || !user) {
    return <AccountPageSkeleton label={t.common.loading} />;
  }

  const fieldPad = isRTL ? 'pr-11 pl-11 text-right' : 'pl-11 pr-11';
  const iconCls = `absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/30 pointer-events-none ${isRTL ? 'right-4' : 'left-4'}`;
  const eyeCls = `hit-area absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/40 hover:text-[#C9A84C] transition-colors ${isRTL ? 'left-4' : 'right-4'}`;

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasLength = password.length >= 8;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.account.title}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.account.settings}
          </h1>
        </div>
      </div>

      <div className={`${cx} py-10 sm:py-14`}>
        <div
          className="grid lg:grid-cols-[280px_1fr] gap-8 lg:gap-14"
          style={{ alignItems: 'start' }}
        >
          <AccountSidebar user={user} onLogout={() => void handleLogout()} />

          <div className="space-y-8">
            <EmailVerificationCard
              user={user}
              onSessionLost={handleSessionLost}
            />

            <PhoneVerificationCard
              user={user}
              onSessionLost={handleSessionLost}
            />

            <div className="border border-[#2D1F1F]/8 rounded-xl p-8 sm:p-10">
              <div className="flex items-start gap-3 mb-8">
                <div className="w-11 h-11 flex items-center justify-center bg-[#C9A84C]/10 rounded-md flex-shrink-0">
                  <ShieldCheck size={18} className="text-[#C9A84C]" />
                </div>
                <div>
                  <h2 className="text-lg font-serif text-[#2D1F1F]">
                    {t.account.changePassword}
                  </h2>
                  <p className="text-sm text-[#2D1F1F]/45 mt-1 leading-relaxed">
                    {t.account.passwordRequirements}
                  </p>
                </div>
              </div>

              <form
                onSubmit={(event) => void handleSubmit(event)}
                autoComplete="off"
                noValidate
              >
                <div className="mb-5">
                  <label htmlFor="current-password" className={labelClass}>
                    {t.account.currentPassword}
                  </label>
                  <div className="relative">
                    <Lock size={16} className={iconCls} />
                    <input
                      id="current-password"
                      name="current-password"
                      type={showCurrent ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => {
                        setCurrentPassword(event.target.value);
                        setFieldErrors((prev) => ({
                          ...prev,
                          current_password: undefined,
                        }));
                      }}
                      disabled={isSubmitting}
                      className={`${inputClass} ${fieldPad} disabled:opacity-60`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((open) => !open)}
                      className={eyeCls}
                      aria-label={
                        showCurrent
                          ? t.common.hidePassword
                          : t.common.showPassword
                      }
                    >
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.current_password ? (
                    <p className="mt-2 text-xs text-red-500">
                      {localizePasswordChangeField(
                        fieldErrors.current_password,
                        t,
                      )}
                    </p>
                  ) : null}
                </div>

                <div className="mb-5">
                  <label htmlFor="new-password" className={labelClass}>
                    {t.account.newPassword}
                  </label>
                  <div className="relative">
                    <Lock size={16} className={iconCls} />
                    <input
                      id="new-password"
                      name="new-password"
                      type={showNew ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setFieldErrors((prev) => ({
                          ...prev,
                          password: undefined,
                        }));
                      }}
                      disabled={isSubmitting}
                      className={`${inputClass} ${fieldPad} disabled:opacity-60`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((open) => !open)}
                      className={eyeCls}
                      aria-label={
                        showNew ? t.common.hidePassword : t.common.showPassword
                      }
                    >
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p className="mt-2 text-xs text-red-500">
                      {localizePasswordChangeField(
                        fieldErrors.password,
                        t,
                      )}
                    </p>
                  ) : null}
                  <ul className="mt-3 space-y-1 text-[11px] text-[#2D1F1F]/40">
                    <li className={hasLength ? 'text-emerald-600' : ''}>
                      {t.common.eightOrMoreCharacters}
                    </li>
                    <li className={hasUpper ? 'text-emerald-600' : ''}>
                      {t.common.uppercaseLetter}
                    </li>
                    <li className={hasLower ? 'text-emerald-600' : ''}>
                      {t.common.lowercaseLetter}
                    </li>
                    <li className={hasNumber ? 'text-emerald-600' : ''}>
                      {t.common.aNumber}
                    </li>
                  </ul>
                </div>

                <div className="mb-8">
                  <label htmlFor="confirm-new-password" className={labelClass}>
                    {t.account.confirmNewPassword}
                  </label>
                  <div className="relative">
                    <Lock size={16} className={iconCls} />
                    <input
                      id="confirm-new-password"
                      name="confirm-new-password"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passwordConfirmation}
                      onChange={(event) => {
                        setPasswordConfirmation(event.target.value);
                        setFieldErrors((prev) => ({
                          ...prev,
                          password_confirmation: undefined,
                        }));
                      }}
                      disabled={isSubmitting}
                      className={`${inputClass} ${fieldPad} disabled:opacity-60`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((open) => !open)}
                      className={eyeCls}
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
                    <p className="mt-2 text-xs text-red-500">
                      {localizePasswordChangeField(
                        fieldErrors.password_confirmation,
                        t,
                      )}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] hover:text-[#2D1F1F] transition-colors disabled:opacity-60 disabled:hover:bg-[#2D1F1F] disabled:hover:text-white flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  {t.account.updatePassword}
                </button>
              </form>
            </div>
              <DeleteAccountCard disabled={isSubmitting} />
          </div>
        </div>
      </div>
    </div>
  );
}
