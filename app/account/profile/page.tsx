'use client';

import { FormEvent, useEffect, useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Mail, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import AccountSidebar from '@/components/account/AccountSidebar';
import RefundBankAccountCard from '@/components/account/RefundBankAccountCard';
import InternationalPhoneInput from '@/components/common/InternationalPhoneInput';
import { patchAccountProfile, uploadProfileAvatar } from '@/lib/api/account';
import {
  localizeProfileUpdateError,
  localizeProfileUpdateField,
} from '@/lib/auth/profile';
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  PROFILE_GENDERS,
  validateProfilePatch,
  type ProfileGender,
  type ProfilePatch,
} from '@/lib/account/profile';
import { isLegacyPhoneValue, parseStoredPhoneCountry } from '@/lib/phone/international';
import type { ProfileUpdateFields } from '@/types/api/account';
import { AccountPageSkeleton } from '@/components/common/Loading';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';
const inputClass =
  'w-full h-11 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';
const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';
const readonlyClass =
  'w-full h-11 border border-[#2D1F1F]/8 bg-[#F3EEE6] text-sm text-[#2D1F1F]/55 rounded-md cursor-not-allowed';

type FormState = {
  name: string;
  phone: string;
  dateOfBirth: string;
  gender: ProfileGender;
};

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-xs text-red-600" role="alert">
      {message}
    </p>
  );
}

export default function AccountProfilePage() {
  const { language, t, isRTL } = useLanguage();
  const { showToast } = useApp();
  const router = useRouter();
  const { user, isAuthenticated, isAuthLoading, logout, refreshSession } =
    useAuth();

  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    dateOfBirth: '',
    gender: 'unspecified',
  });
  const [fieldErrors, setFieldErrors] = useState<ProfileUpdateFields>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [phoneIncomplete, setPhoneIncomplete] = useState(false);
  const [phoneResetKey, setPhoneResetKey] = useState(0);
  const submittingRef = useRef(false);
  const hydratedRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!user) return;
    if (hydratedRef.current === user.id) return;
    hydratedRef.current = user.id;
    setForm({
      name: user.name,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth ?? '',
      gender: user.gender ?? 'unspecified',
    });
    setPhoneResetKey((key) => key + 1);
  }, [user]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    const errorKey = key === 'dateOfBirth' ? 'date_of_birth' : key;
    setFieldErrors((prev) => {
      if (!prev[errorKey as keyof ProfileUpdateFields]) return prev;
      const next = { ...prev };
      delete next[errorKey as keyof ProfileUpdateFields];
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    showToast(t.common.signedOut, 'success');
    router.push('/');
  };

  const handleSessionLost = async () => {
    await logout();
    router.replace('/login');
  };

  /** Only the fields that changed are sent. */
  const buildPatch = (): ProfilePatch => {
    if (!user) return {};
    const patch: ProfilePatch = {};
    if (form.name.trim() !== user.name.trim()) patch.name = form.name.trim();
    const phone = form.phone.trim();
    if (phone !== (user.phone ?? '').trim()) patch.phone = phone || null;
    if (form.dateOfBirth !== (user.dateOfBirth ?? '')) {
      patch.dateOfBirth = form.dateOfBirth || null;
    }
    if (form.gender !== (user.gender ?? 'unspecified')) patch.gender = form.gender;
    return patch;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || isSubmitting || !user) return;

    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      showToast(t.account.profileNameUnchanged, 'info');
      return;
    }
    const errors = validateProfilePatch(patch);
    if (phoneIncomplete && patch.phone !== undefined) errors.phone = 'invalid';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await patchAccountProfile(patch);
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await handleSessionLost();
          return;
        }
        setFieldErrors(result.fields ?? {});
        showToast(localizeProfileUpdateError(result, t), 'error');
        return;
      }

      const refreshed = await refreshSession();
      if (!refreshed.ok) {
        showToast(t.account.sessionRefreshFailed, 'error');
        return;
      }
      hydratedRef.current = null; // re-read the saved values
      showToast(t.account.profileUpdated, 'success');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handlePhotoChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isUploading) return;
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
      showToast(t.account.photoInvalidType, 'error');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      showToast(t.account.photoTooLarge, 'error');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadProfileAvatar(file);
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await handleSessionLost();
          return;
        }
        showToast(localizeProfileUpdateError(result, t), 'error');
        return;
      }
      await refreshSession();
      showToast(t.account.photoUpdated, 'success');
    } finally {
      setIsUploading(false);
    }
  };

  if (isAuthLoading || !isAuthenticated || !user) {
    return <AccountPageSkeleton label={t.common.loading} />;
  }

  const fieldPad = isRTL ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4';
  const iconCls = `absolute top-1/2 -translate-y-1/2 text-[#2D1F1F]/30 pointer-events-none ${isRTL ? 'right-4' : 'left-4'}`;
  const dirty = Object.keys(buildPatch()).length > 0;
  const today = new Date().toISOString().slice(0, 10);
  const genderLabels: Record<ProfileGender, string> = {
    unspecified: t.account.genderUnspecified,
    male: t.account.genderMale,
    female: t.account.genderFemale,
  };
  const errorFor = (field: keyof ProfileUpdateFields) => {
    const code = fieldErrors[field];
    return code ? localizeProfileUpdateField(code, t, field) : null;
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.account.title}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.account.editProfile}
          </h1>
        </div>
      </div>

      <div className={`${cx} py-14 sm:py-20`}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10">
          <AccountSidebar user={user} onLogout={() => void handleLogout()} />

          <div className="space-y-10 min-w-0">
          <div className="border border-[#2D1F1F]/8 rounded-xl p-8 sm:p-10">
            <div className="flex items-start gap-3 mb-8">
              <div className="w-11 h-11 flex items-center justify-center bg-[#C9A84C]/10 rounded-md flex-shrink-0">
                <UserIcon size={18} className="text-[#C9A84C]" />
              </div>
              <div>
                <h2 className="text-lg font-serif text-[#2D1F1F]">
                  {t.account.editProfile}
                </h2>
                <p className="text-sm text-[#2D1F1F]/45 mt-1 leading-relaxed">
                  {t.account.profileHint}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-5 mb-8 pb-8 border-b border-[#2D1F1F]/8">
              <div className="relative w-20 h-20 rounded-full overflow-hidden bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={t.account.profilePhoto}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span className="text-2xl font-serif text-[#C9A84C]">
                    {user.name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                {isUploading ? (
                  <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-white" aria-hidden />
                  </span>
                ) : null}
              </div>
              <div>
                <p className={labelClass}>{t.account.profilePhoto}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 h-10 px-4 border border-[#2D1F1F]/20 rounded-md text-[11px] font-black tracking-[0.15em] uppercase text-[#2D1F1F] hover:border-[#C9A84C] transition-colors disabled:opacity-50"
                >
                  <Camera size={14} aria-hidden />
                  {isUploading ? t.account.uploadingPhoto : t.account.changePhoto}
                </button>
                <p className="mt-2 text-[11px] text-[#2D1F1F]/40">{t.account.photoHint}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={AVATAR_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => void handlePhotoChosen(e)}
                />
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-5">
                <label htmlFor="profile-name" className={labelClass}>
                  {t.account.fullName}
                </label>
                <div className="relative">
                  <UserIcon size={16} className={iconCls} />
                  <input
                    id="profile-name"
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    disabled={isSubmitting}
                    maxLength={255}
                    aria-invalid={fieldErrors.name ? true : undefined}
                    aria-describedby={fieldErrors.name ? 'profile-name-error' : undefined}
                    className={`${inputClass} ${fieldPad} disabled:opacity-60`}
                  />
                </div>
                <FieldError id="profile-name-error" message={errorFor('name')} />
              </div>

              <div className="mb-5">
                <label htmlFor="profile-email" className={labelClass}>
                  {t.checkout.email}
                </label>
                <div className="relative">
                  <Mail size={16} className={iconCls} />
                  <input
                    id="profile-email"
                    type="email"
                    value={user.email}
                    readOnly
                    disabled
                    dir="ltr"
                    className={`${readonlyClass} ${fieldPad}`}
                  />
                </div>
                <p className="mt-2 text-[11px] text-[#2D1F1F]/40">
                  {t.account.profileEmailReadonly}
                </p>
              </div>

              <div className="mb-5">
                <label htmlFor="profile-phone" className={labelClass}>
                  {t.checkout.phone}
                </label>
                <InternationalPhoneInput
                  id="profile-phone"
                  value={form.phone}
                  onChange={(value) => update('phone', value)}
                  onIncompleteChange={setPhoneIncomplete}
                  defaultCountry={parseStoredPhoneCountry(user.phone ?? '') ?? 'OM'}
                  language={language}
                  countryLabel={t.account.phoneCountry}
                  phoneLabel={t.checkout.phone}
                  disabled={isSubmitting}
                  invalid={Boolean(fieldErrors.phone)}
                  describedBy="profile-phone-hint"
                  maxLength={30}
                  resetKey={phoneResetKey}
                  legacyMode={isLegacyPhoneValue(user.phone ?? '')}
                />
                <p id="profile-phone-hint" className="mt-2 text-[11px] text-[#2D1F1F]/40">
                  {t.account.profilePhoneHint}
                </p>
                <FieldError id="profile-phone-error" message={errorFor('phone')} />
              </div>

              <div className="grid sm:grid-cols-2 gap-5 mb-8">
                <div>
                  <label htmlFor="profile-dob" className={labelClass}>
                    {t.account.dateOfBirth}
                  </label>
                  <input
                    id="profile-dob"
                    type="date"
                    dir="ltr"
                    max={today}
                    min="1900-01-01"
                    value={form.dateOfBirth}
                    onChange={(e) => update('dateOfBirth', e.target.value)}
                    disabled={isSubmitting}
                    aria-invalid={fieldErrors.date_of_birth ? true : undefined}
                    className={`${inputClass} px-4 disabled:opacity-60`}
                  />
                  <FieldError id="profile-dob-error" message={errorFor('date_of_birth')} />
                </div>
                <div>
                  <label htmlFor="profile-gender" className={labelClass}>
                    {t.account.gender}
                  </label>
                  <select
                    id="profile-gender"
                    value={form.gender}
                    onChange={(e) => update('gender', e.target.value as ProfileGender)}
                    disabled={isSubmitting}
                    className={`${inputClass} px-4 disabled:opacity-60`}
                  >
                    {PROFILE_GENDERS.map((gender) => (
                      <option key={gender} value={gender}>
                        {genderLabels[gender]}
                      </option>
                    ))}
                  </select>
                  <FieldError id="profile-gender-error" message={errorFor('gender')} />
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitting || !dirty}
                className="h-12 px-8 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.25em] uppercase rounded-md hover:bg-[#C9A84C] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  t.account.saveProfile
                )}
              </motion.button>
            </form>
          </div>

          <RefundBankAccountCard onSessionLost={handleSessionLost} />
          </div>
        </div>
      </div>
    </div>
  );
}
