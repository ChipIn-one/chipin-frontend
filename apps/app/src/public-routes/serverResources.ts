// Build-time only (spec 04 §2.10): the SSG prerender (`entry-server.tsx`,
// `scripts/prerender-public.mjs`) renders synchronously, so it takes every locale eagerly here. The
// client never imports this module: it loads each namespace lazily (`i18n/index.ts`).
import enCommon from '@chipin/i18n-content/common/en.json';
import ruCommon from '@chipin/i18n-content/common/ru.json';
import type { Resource, ResourceLanguage } from 'i18next';

import { SUPPORTED_LOCALES, type SupportedLocale } from 'constants/locales';

const COMMON: Record<SupportedLocale, ResourceLanguage> = { en: enCommon, ru: ruCommon };

// Key `../i18n/locales/<lng>/<ns>.json`.
const APP_NAMESPACES = import.meta.glob<ResourceLanguage>('../i18n/locales/*/*.json', {
    eager: true,
    import: 'default',
});
const NAMESPACE_PATH = /^\.\.\/i18n\/locales\/([^/]+)\/([^/]+)\.json$/;

const namespacesOf = (lng: SupportedLocale): ResourceLanguage =>
    Object.fromEntries(
        Object.entries(APP_NAMESPACES).flatMap(([file, content]) => {
            const [, fileLng, ns] = NAMESPACE_PATH.exec(file) ?? [];

            return fileLng === lng && ns ? [[ns, content]] : [];
        }),
    );

const resources: Resource = Object.fromEntries(
    SUPPORTED_LOCALES.map(lng => [lng, { common: COMMON[lng], ...namespacesOf(lng) }]),
);

export { resources };
