import type { SupportedLocale } from './locales';
import enJoin from './locales/en/join.json';
import enLanding from './locales/en/landing.json';
import enMeta from './locales/en/meta.json';
import enShared from './locales/en/shared.json';
import ruJoin from './locales/ru/join.json';
import ruLanding from './locales/ru/landing.json';
import ruMeta from './locales/ru/meta.json';
import ruShared from './locales/ru/shared.json';

// Every locale has the shape of `en` (type-checked here; key parity also in parity.test.ts).
// `landing` and `shared` are copies of app texts (landingParity.test.ts): `landing` the part of the
// app `landing` namespace the landing renders, `shared` the texts it takes from other namespaces.
type Messages = {
    meta: typeof enMeta;
    join: typeof enJoin;
    landing: typeof enLanding;
    shared: typeof enShared;
};

const MESSAGES: Record<SupportedLocale, Messages> = {
    en: { meta: enMeta, join: enJoin, landing: enLanding, shared: enShared },
    ru: { meta: ruMeta, join: ruJoin, landing: ruLanding, shared: ruShared },
};

/** The site texts of a locale (spec 04 §3.2: no inline strings in `.astro`). */
const messages = (locale: SupportedLocale): Messages => MESSAGES[locale];

/** Fills the i18next-style `{{name}}` placeholders of an app text. */
const interpolate = (template: string, values: Record<string, string | number>): string =>
    template.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) => {
        const value = values[name];

        return value === undefined ? placeholder : String(value);
    });

export { interpolate, messages };
