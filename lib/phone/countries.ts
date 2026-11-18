'use client';

import {
  getCountries,
  getCountryCallingCode,
  type Country,
} from 'react-phone-number-input';

export type LocalizedCountryOption = {
  code: string;
  name: string;
  callingPrefix?: string;
};

function createCountryDisplayNames(locale: string): Intl.DisplayNames {
  return new Intl.DisplayNames([locale], { type: 'region' });
}

function displayNameFor(code: string, displayNames: Intl.DisplayNames): string {
  try {
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function callingPrefixFor(code: string): string | undefined {
  try {
    return `+${getCountryCallingCode(code as Country)}`;
  } catch {
    return undefined;
  }
}

export function getLocalizedCountryOptions(
  locale: string,
  extraCode?: string | null,
): LocalizedCountryOption[] {
  const displayNames = createCountryDisplayNames(locale);
  const codes = new Set<string>(getCountries());
  const extra = extraCode?.trim().toUpperCase();
  if (extra && extra.length === 2) codes.add(extra);

  const options: LocalizedCountryOption[] = [];
  for (const code of codes) {
    options.push({
      code,
      name: displayNameFor(code, displayNames),
      callingPrefix: callingPrefixFor(code),
    });
  }

  options.sort((a, b) => a.name.localeCompare(b.name, locale));
  return options;
}

export function getLocalizedCountryLabels(
  locale: string,
): Record<string, string> {
  const displayNames = createCountryDisplayNames(locale);
  const labels: Record<string, string> = {};
  for (const code of getCountries()) {
    labels[code] = displayNameFor(code, displayNames);
  }
  return labels;
}
