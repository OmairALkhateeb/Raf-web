'use client';

import { useMemo, useSyncExternalStore } from 'react';
import type { Language } from '@/types';
import { getLocalizedCountryOptions } from '@/lib/phone/countries';

const selectClass =
  'w-full h-11 px-4 border border-[#2D1F1F]/15 bg-[#FAF7F2] text-sm text-[#2D1F1F] rounded-md focus:outline-none focus:border-[#C9A84C] transition-colors';

const noSubscribe = () => () => {};

type CountrySelectProps = {
  id: string;
  value: string;
  onChange: (code: string) => void;
  language: Language;
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  extraCode?: string | null;
  allowEmpty?: boolean;
};

export default function CountrySelect({
  id,
  value,
  onChange,
  language,
  placeholder,
  disabled = false,
  invalid = false,
  describedBy,
  extraCode,
  allowEmpty = false,
}: CountrySelectProps) {
  const locale = language === 'ar' ? 'ar' : 'en';
  // Country names come from the runtime's own name data, which differs between
  // the server (Node) and the browser (e.g. "Falkland Islands" vs "Falkland
  // Islands (Islas Malvinas)"), so the list is built in the browser only. The
  // server and the first browser render show just the chosen code, so they match.
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const options = useMemo(
    () => (inBrowser ? getLocalizedCountryOptions(locale, extraCode ?? value) : []),
    [inBrowser, locale, extraCode, value],
  );

  return (
    <select
      id={id}
      name="country"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      autoComplete="country"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={selectClass}
    >
      <option value="" disabled={!allowEmpty && Boolean(value)}>
        {placeholder}
      </option>
      {!inBrowser && value ? <option value={value}>{value}</option> : null}
      {options.map((option) => (
        <option
          key={option.code}
          value={option.code}
          title={option.callingPrefix}
        >
          {option.name}
        </option>
      ))}
    </select>
  );
}
