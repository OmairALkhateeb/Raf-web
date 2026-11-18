'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import type { RefundAccountFields as FieldErrors } from '@/types/api/account';

const inputClass =
  'w-full h-11 px-4 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors disabled:opacity-60';
const labelClass =
  'block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2';

/** IBAN + account holder name, with the backend's or our messages under each. */
export default function RefundAccountFields({
  idPrefix,
  iban,
  accountName,
  onIbanChange,
  onAccountNameChange,
  errors,
  disabled,
  ibanMaxLength,
  nameMaxLength,
  placeholder,
}: {
  idPrefix: string;
  iban: string;
  accountName: string;
  onIbanChange: (value: string) => void;
  onAccountNameChange: (value: string) => void;
  errors: FieldErrors;
  disabled: boolean;
  ibanMaxLength: number;
  nameMaxLength: number;
  placeholder: string;
}) {
  const { t } = useLanguage();
  const ibanError = errors.refund_iban;
  const nameError = errors.refund_account_name;

  return (
    <div className="space-y-4 text-start">
      <div>
        <label htmlFor={`${idPrefix}-iban`} className={labelClass}>
          {t.account.refundAccountIban}
        </label>
        <input
          id={`${idPrefix}-iban`}
          type="text"
          dir="ltr"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={iban}
          onChange={(e) => onIbanChange(e.target.value)}
          disabled={disabled}
          maxLength={ibanMaxLength}
          placeholder={placeholder}
          aria-invalid={ibanError ? true : undefined}
          aria-describedby={ibanError ? `${idPrefix}-iban-error` : undefined}
          className={`${inputClass} tracking-wide`}
        />
        {ibanError ? (
          <p id={`${idPrefix}-iban-error`} className="mt-2 text-xs text-red-600" role="alert">
            {ibanError}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-name`} className={labelClass}>
          {t.account.refundAccountName}
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          autoComplete="name"
          value={accountName}
          onChange={(e) => onAccountNameChange(e.target.value)}
          disabled={disabled}
          maxLength={nameMaxLength}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={`${idPrefix}-name-hint${nameError ? ` ${idPrefix}-name-error` : ''}`}
          className={inputClass}
        />
        <p id={`${idPrefix}-name-hint`} className="mt-2 text-[11px] text-[#2D1F1F]/40">
          {t.account.refundAccountNameHint}
        </p>
        {nameError ? (
          <p id={`${idPrefix}-name-error`} className="mt-1 text-xs text-red-600" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
