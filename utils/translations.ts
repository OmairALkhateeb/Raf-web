// Compatibility surface: the dictionaries now live in ./locales, but the
// `translations.en` / `translations.ar` shape is preserved so existing
// importers do not need to change.
import { en } from './locales/en';
import { ar } from './locales/ar';

export type { Dictionary } from './locales/en';

export const translations = { en, ar };
