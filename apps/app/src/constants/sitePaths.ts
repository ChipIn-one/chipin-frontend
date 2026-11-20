import type { SupportedLocale } from 'constants/locales';
import { LOCALE_PREFIX } from 'constants/publicRouteManifest';

// Spec 04 §2.1 (04-2f): links from the app to the site pages (landing, privacy, terms). They are
// used only as `<a href>` or `window.location.assign`, never in `navigate` or `<Link>`: after 04-2g
// they point to another origin (`getSiteOrigin()` + path). `ROUTES` has no site pages (lint
// `no-restricted-syntax#site-paths`). The spec places this file in `app/router`; it lives in the
// base layer because helpers, components and pages link to the site and cannot import `app`.
const SITE_PATHS = {
    home: '/',
    privacy: '/privacy',
    terms: '/terms',
    localeHome: (locale: SupportedLocale): string => `${LOCALE_PREFIX[locale]}/`,
} as const;

export { SITE_PATHS };
