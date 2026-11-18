'use client';

import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type InputHTMLAttributes,
} from 'react';
import PhoneInput, { type Labels } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';
import type { Language } from '@/types';
import { getLocalizedCountryLabels } from '@/lib/phone/countries';
import {
  isCallingCodePrefixOnly,
  type PhoneCountry,
} from '@/lib/phone/international';

const legacyInputClass =
  'w-full h-11 px-4 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] placeholder-[#2D1F1F]/30 rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';

function subscribeNoop() {
  return () => {};
}

function getClientMounted() {
  return true;
}

function getServerMounted() {
  return false;
}

type PhoneTextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  onDisplayChange?: (display: string) => void;
};

const PhoneTextInput = forwardRef<HTMLInputElement, PhoneTextInputProps>(
  function PhoneTextInput({ onDisplayChange, onChange, ...props }, ref) {
    return (
      <input
        {...props}
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        onChange={(event) => {
          const sanitized = event.target.value.replace(
            /[A-Za-z\u0600-\u06FF]/g,
            '',
          );
          if (sanitized !== event.target.value) {
            event.target.value = sanitized;
          }
          onDisplayChange?.(event.target.value);
          onChange?.(event);
        }}
      />
    );
  },
);

type InternationalPhoneInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onIncompleteChange?: (incomplete: boolean) => void;
  onCountryChange?: (country?: PhoneCountry) => void;
  onBlur?: () => void;
  defaultCountry?: PhoneCountry;
  language: Language;
  countryLabel: string;
  phoneLabel: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  maxLength: number;
  resetKey: string | number;
  legacyMode?: boolean;
  legacyHint?: string;
};

export default function InternationalPhoneInput({
  id,
  value,
  onChange,
  onIncompleteChange,
  onCountryChange,
  onBlur,
  defaultCountry,
  language,
  countryLabel,
  phoneLabel,
  disabled = false,
  invalid = false,
  describedBy,
  maxLength,
  resetKey,
  legacyMode = false,
  legacyHint,
}: InternationalPhoneInputProps) {
  const locale = language === 'ar' ? 'ar' : 'en';
  const labels = useMemo(
    () =>
      ({
        ...getLocalizedCountryLabels(locale),
        country: countryLabel,
        phone: phoneLabel,
      }) as Labels,
    [locale, countryLabel, phoneLabel],
  );

  const selectedCountryRef = useRef<PhoneCountry | undefined>(defaultCountry);
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientMounted,
    getServerMounted,
  );

  useEffect(() => {
    selectedCountryRef.current = defaultCountry;
  }, [defaultCountry, resetKey]);

  if (legacyMode) {
    return (
      <div>
        <input
          id={id}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onBlur={onBlur}
          onChange={(event) => {
            onChange(event.target.value);
            onIncompleteChange?.(false);
          }}
          className={legacyInputClass}
        />
        {legacyHint ? (
          <p
            id={describedBy}
            className="mt-2 text-xs text-[#2D1F1F]/55"
            role="status"
          >
            {legacyHint}
          </p>
        ) : null}
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="raf-phone-input">
        <input
          id={id}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          disabled={disabled}
          readOnly
          value=""
          aria-label={phoneLabel}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="PhoneInputInput"
        />
      </div>
    );
  }

  return (
    <PhoneInput
      key={resetKey}
      id={id}
      name="phone"
      international
      defaultCountry={defaultCountry}
      flags={flags}
      labels={labels}
      locales={locale}
      addInternationalOption={false}
      limitMaxLength
      countryCallingCodeEditable
      focusInputOnCountrySelection={false}
      value={value || undefined}
      disabled={disabled}
      onBlur={onBlur}
      onCountryChange={(country) => {
        selectedCountryRef.current = country;
        onCountryChange?.(country);
      }}
      onChange={(next) => {
        const nextValue = next ?? '';
        onChange(nextValue);
        if (nextValue) onIncompleteChange?.(false);
      }}
      className="raf-phone-input"
      numberInputProps={{
        maxLength,
        type: 'tel',
        inputMode: 'tel',
        autoComplete: 'tel',
        'aria-invalid': invalid || undefined,
        'aria-describedby': describedBy,
        onDisplayChange: (display: string) => {
          onIncompleteChange?.(
            !value &&
              !isCallingCodePrefixOnly(display, selectedCountryRef.current),
          );
        },
      }}
      countrySelectProps={{
        'aria-label': countryLabel,
      }}
      inputComponent={PhoneTextInput}
    />
  );
}
