import type { SupportedLocale } from './locales';
import enMeta from './locales/en/meta.json';
import ruMeta from './locales/ru/meta.json';

// Every locale has the shape of `en` (type-checked here; key parity also in parity.test.ts).
type Messages = { meta: typeof enMeta };

const MESSAGES: Record<SupportedLocale, Messages> = {
    en: { meta: enMeta },
    ru: { meta: ruMeta },
};

/** The site texts of a locale (spec 04 §3.2: no inline strings in `.astro`). */
const messages = (locale: SupportedLocale): Messages => MESSAGES[locale];

export { messages };
