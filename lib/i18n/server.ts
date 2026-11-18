import 'server-only';

import { cookies } from 'next/headers';
import type { Language } from '@/types';
import { translations, type Dictionary } from '@/utils/translations';
import { LANGUAGE_COOKIE, parseLanguage } from './language';

/** The visitor's UI language from the `raf-language` cookie (English if unset). */
export async function getServerLanguage(): Promise<Language> {
  const jar = await cookies();
  return parseLanguage(jar.get(LANGUAGE_COOKIE)?.value);
}

export async function getServerDictionary(): Promise<{
  language: Language;
  t: Dictionary;
}> {
  const language = await getServerLanguage();
  return { language, t: translations[language] };
}
