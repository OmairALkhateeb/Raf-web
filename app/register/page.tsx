'use client';

import { useState, FormEvent, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User as UserIcon, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { localizeAuthError } from '@/lib/auth/messages';
import { passwordMeetsPolicy } from '@/lib/auth/password';
import InternationalPhoneInput from '@/components/common/InternationalPhoneInput';
import { isPossibleInternationalPhone } from '@/lib/phone/international';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';
const inputClass = 'w-full h-12 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';
const labelClass = 'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

interface FormState {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

function getPasswordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (password.length >= 10 && /[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 3) as 0 | 1 | 2 | 3;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const { showToast } = useApp();

  const [form, setForm] = useState<FormState>({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [phoneIncomplete, setPhoneIncomplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field: keyof FormState, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const strengthLabel = [
    t.auth.tooWeak,
    t.auth.weak,
    t.auth.good,
    t.auth.strong,
  ][strength];
  const strengthColor = ['bg-red-400', 'bg-amber-400', 'bg-[#C9A84C]', 'bg-emerald-500'][strength];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.name.trim() || !form.email.trim()) {
      showToast(t.auth.nameAndEmailRequired, 'error');
      return;
    }

    if (!passwordMeetsPolicy(form.password)) {
      showToast(t.auth.passwordPolicy, 'error');
      return;
    }

    if (form.password !== form.confirmPassword) {
      showToast(t.auth.passwordMismatch, 'error');
      return;
    }

    const phone = form.phone.trim();
    if (
      phoneIncomplete ||
      (phone && !isPossibleInternationalPhone(phone))
    ) {
      showToast(t.auth.phoneInvalid, 'error');
      return;
    }

    if (!acceptTerms) {
      showToast(t.auth.acceptTermsRequired, 'error');
      return;
    }

    setIsSubmitting(true);
    const result = await register({
      name: form.name,
      email: form.email,
      phone,
      password: form.password,
      passwordConfirmation: form.confirmPassword,
    });
    setIsSubmitting(false);

    if (result.success) {
      showToast(t.auth.accountCreated, 'success');
      router.push('/account');
    } else {
      showToast(
        result.error
          ? localizeAuthError(result.error, t, 'passthrough')
          : t.common.error,
        'error',
      );
    }
  };

  const fieldIconCls = `absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/30 pointer-events-none ${isRTL ? 'right-4' : 'left-4'}`;
  const fieldPad = isRTL ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Page header */}
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.auth.joinRaf}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">{t.auth.createAccount}</h1>
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
            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div className="mb-5">
                <label htmlFor="reg-name" className={labelClass}>{t.checkout.fullName}</label>
                <div className="relative">
                  <UserIcon size={16} className={fieldIconCls} />
                  <input
                    id="reg-name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder={t.auth.namePlaceholder}
                    className={`${inputClass} ${fieldPad}`}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="mb-5">
                <label htmlFor="reg-email" className={labelClass}>{t.checkout.email}</label>
                <div className="relative">
                  <Mail size={16} className={fieldIconCls} />
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder={t.auth.emailPlaceholder}
                    className={`${inputClass} ${fieldPad}`}
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="mb-5">
                <label htmlFor="reg-phone" className={labelClass}>{t.auth.phoneOptional}</label>
                <InternationalPhoneInput
                  id="reg-phone"
                  value={form.phone}
                  onChange={(next) => update('phone', next)}
                  onIncompleteChange={setPhoneIncomplete}
                  defaultCountry="OM"
                  language={language}
                  countryLabel={t.account.phoneCountry}
                  phoneLabel={t.auth.phoneOptional}
                  invalid={
                    phoneIncomplete ||
                    (Boolean(form.phone.trim()) &&
                      !isPossibleInternationalPhone(form.phone))
                  }
                  maxLength={30}
                  resetKey="register"
                />
              </div>

              {/* Password */}
              <div className="mb-2">
                <label htmlFor="reg-password" className={labelClass}>{t.auth.password}</label>
                <div className="relative">
                  <Lock size={16} className={fieldIconCls} />
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} ${isRTL ? 'pr-11 pl-11 text-right' : 'pl-11 pr-11'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className={`hit-area absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/40 hover:text-[#C9A84C] transition-colors ${isRTL ? 'left-4' : 'right-4'}`}
                    aria-label={showPassword ? t.common.hidePassword : t.common.showPassword}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {form.password && (
                  <div className="mt-2.5">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-md transition-colors ${i < strength ? strengthColor : 'bg-[#2D1F1F]/8'}`} />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-[#2D1F1F]/40">{strengthLabel}</p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="mb-6">
                <label htmlFor="reg-confirm-password" className={labelClass}>{t.account.confirmNewPassword}</label>
                <div className="relative">
                  <Lock size={16} className={fieldIconCls} />
                  <input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={e => update('confirmPassword', e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} ${isRTL ? 'pr-11 pl-11 text-right' : 'pl-11 pr-11'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(s => !s)}
                    className={`hit-area absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/40 hover:text-[#C9A84C] transition-colors ${isRTL ? 'left-4' : 'right-4'}`}
                    aria-label={showConfirmPassword ? t.common.hidePassword : t.common.showPassword}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {form.confirmPassword && form.confirmPassword === form.password && (
                    <Check size={16} className={`absolute top-1/2 -translate-y-1/2 text-emerald-500 ${isRTL ? 'left-11' : 'right-11'}`} />
                  )}
                </div>
              </div>

              {/* Terms */}
              <div className="mb-7">
                <div className="flex items-start gap-2.5 select-none">
                  <input
                    id="reg-terms"
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={e => setAcceptTerms(e.target.checked)}
                    aria-required="true"
                    className="accent-[#C9A84C] w-4 h-4 mt-0.5 flex-shrink-0"
                  />
                  <p className={`text-sm text-[#2D1F1F]/60 leading-relaxed ${isRTL ? 'text-right' : ''}`}>
                    <label htmlFor="reg-terms" className="cursor-pointer">
                      {t.auth.agreeTo}
                    </label>
                    <Link
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#2D1F1F] hover:text-[#C9A84C] transition-colors"
                    >
                      {t.footer.terms}
                    </Link>
                    {t.auth.and}
                    <Link
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#2D1F1F] hover:text-[#C9A84C] transition-colors"
                    >
                      {t.footer.privacy}
                    </Link>
                  </p>
                </div>
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
                    {t.auth.createAccount}
                    <ArrowRight size={14} className={isRTL ? 'rtl-flip' : ''} />
                  </>
                )}
              </motion.button>
            </form>

            <div className="flex items-center gap-3 my-7">
              <div className="flex-1 h-px bg-[#2D1F1F]/8" />
              <span className="text-[10px] font-black tracking-[0.15em] uppercase text-[#2D1F1F]/30">{t.common.or}</span>
              <div className="flex-1 h-px bg-[#2D1F1F]/8" />
            </div>

            <p className="text-center text-sm text-[#2D1F1F]/55">
              {t.auth.alreadyHaveAccount}{' '}
              <Link href="/login" className="font-bold text-[#C9A84C] hover:text-[#2D1F1F] transition-colors">
                {t.common.signIn}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
