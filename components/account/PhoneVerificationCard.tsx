'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { postSendPhoneVerification, postVerifyPhone } from '@/lib/api/auth';
import {
  PHONE_VERIFY_RESEND_COOLDOWN_MS,
  localizePhoneVerifyError,
  localizePhoneVerifyField,
} from '@/lib/auth/phone-verification';
import type { User } from '@/types';
import type { PhoneVerifyFields } from '@/types/api/auth';

const inputClass =
  'w-full h-11 px-4 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors tracking-[0.35em]';
const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';
const primaryBtn =
  'h-12 px-5 bg-[#2D1F1F] text-white text-[11px] font-black tracking-[0.2em] uppercase rounded-md hover:bg-[#C9A84C] hover:text-[#2D1F1F] transition-colors disabled:opacity-60 disabled:hover:bg-[#2D1F1F] disabled:hover:text-white flex items-center justify-center gap-2';
const secondaryBtn =
  'h-12 px-5 border border-[#2D1F1F]/15 text-[11px] font-black tracking-[0.2em] uppercase rounded-md text-[#2D1F1F] hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors disabled:opacity-60 flex items-center justify-center gap-2';

interface PhoneVerificationCardProps {
  user: User;
  onSessionLost: () => Promise<void>;
}

export default function PhoneVerificationCard({
  user,
  onSessionLost,
}: PhoneVerificationCardProps) {
  const { t, isRTL } = useLanguage();
  const { showToast } = useApp();
  const { refreshSession } = useAuth();

  const [code, setCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<PhoneVerifyFields>({});
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const sendingRef = useRef(false);
  const verifyingRef = useRef(false);

  const hasPhone = user.phone.trim() !== '';

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const coolingDown = cooldownSeconds > 0;
  const busy = isSending || isVerifying;

  const handleSend = async () => {
    if (!hasPhone || sendingRef.current || isSending || coolingDown) return;
    sendingRef.current = true;
    setIsSending(true);
    setFieldErrors({});

    try {
      const result = await postSendPhoneVerification();
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await onSessionLost();
          return;
        }
        showToast(localizePhoneVerifyError(result, t), 'error');
        return;
      }
      setCooldownUntil(Date.now() + PHONE_VERIFY_RESEND_COOLDOWN_MS);
      setNow(Date.now());
      showToast(t.account.phoneVerificationCodeSent, 'success');
    } catch (error) {
      console.error(
        'Phone verification send failed',
        error instanceof Error ? error.name : 'unknown',
      );
      showToast(
        localizePhoneVerifyError({ ok: false, code: 'unavailable' }, t),
        'error',
      );
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasPhone || verifyingRef.current || isVerifying) return;

    const trimmed = code.trim();
    setFieldErrors({});

    if (!trimmed) {
      setFieldErrors({ code: 'required' });
      showToast(localizePhoneVerifyField('required', t), 'error');
      return;
    }

    if (trimmed.length !== 6) {
      setFieldErrors({ code: 'format' });
      showToast(localizePhoneVerifyField('format', t), 'error');
      return;
    }

    verifyingRef.current = true;
    setIsVerifying(true);

    try {
      const result = await postVerifyPhone(trimmed);
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          await onSessionLost();
          return;
        }
        setFieldErrors(result.fields ?? {});
        showToast(localizePhoneVerifyError(result, t), 'error');
        return;
      }

      setCode('');
      setFieldErrors({});
      const refreshed = await refreshSession();
      if (!refreshed.ok) {
        showToast(
          localizePhoneVerifyError(
            { ok: false, code: 'unavailable' },
            t,
          ),
          'error',
        );
        return;
      }
      showToast(t.account.phoneVerifiedSuccess, 'success');
    } catch (error) {
      console.error(
        'Phone verification failed',
        error instanceof Error ? error.name : 'unknown',
      );
      showToast(
        localizePhoneVerifyError({ ok: false, code: 'unavailable' }, t),
        'error',
      );
    } finally {
      verifyingRef.current = false;
      setIsVerifying(false);
    }
  };

  const sendLabel =
    cooldownUntil > 0
      ? t.account.resendVerificationCode
      : t.account.sendPhoneVerificationCode;

  return (
    <div className="border border-[#2D1F1F]/8 rounded-xl p-8 sm:p-10">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 flex items-center justify-center bg-[#C9A84C]/10 rounded-md flex-shrink-0">
          {user.phoneVerified ? (
            <CheckCircle2 size={18} className="text-emerald-600" />
          ) : (
            <Smartphone size={18} className="text-[#C9A84C]" />
          )}
        </div>
        <div>
          <h2 className="text-lg font-serif text-[#2D1F1F]">
            {t.account.phoneVerification}
          </h2>
          <p className="text-sm text-[#2D1F1F]/45 mt-1 leading-relaxed">
            {hasPhone ? user.phone : '—'}
          </p>
        </div>
      </div>

      {!hasPhone ? (
        <p className="text-sm text-[#2D1F1F]/55 leading-relaxed">
          {t.account.phoneMissing}
        </p>
      ) : user.phoneVerified ? (
        <div>
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 size={16} />
            <span>{t.account.phoneVerified}</span>
          </div>
          <p className="text-sm text-[#2D1F1F]/45 mt-2">
            {t.account.phoneVerifiedHint}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-[#2D1F1F]/55 mb-6 leading-relaxed">
            {t.account.phoneNotVerified} {t.account.phoneVerificationCodeHint}
          </p>

          <div className={`mb-6 ${isRTL ? 'text-right' : ''}`}>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={busy || coolingDown}
              className={`${secondaryBtn} w-full sm:w-auto`}
            >
              {isSending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              {coolingDown
                ? `${t.account.resendIn} ${cooldownSeconds}s`
                : sendLabel}
            </button>
          </div>

          <form
            onSubmit={(event) => void handleVerify(event)}
            autoComplete="off"
            noValidate
          >
            <div className="mb-6">
              <label htmlFor="phone-verification-code" className={labelClass}>
                {t.account.verificationCode}
              </label>
              <input
                id="phone-verification-code"
                name="phone-verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                  setFieldErrors((prev) => ({ ...prev, code: undefined }));
                }}
                disabled={busy}
                className={`${inputClass} ${isRTL ? 'text-right' : ''} disabled:opacity-60`}
              />
              {fieldErrors.code ? (
                <p className="mt-2 text-xs text-red-500">
                  {localizePhoneVerifyField(fieldErrors.code, t)}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={busy}
              className={`${primaryBtn} w-full`}
            >
              {isVerifying ? (
                <Loader2 size={16} className="animate-spin" />
              ) : null}
              {t.account.verifyPhone}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
