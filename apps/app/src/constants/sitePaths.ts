import { LOCALE_PATH, type SupportedLocale } from 'constants/locales';

// Spec 04 §2.1 (04-2f, 04-2g): the paths of the site pages (landing, privacy, terms) relative to the
// site origin. Links from the app to the site use the absolute `SITE_PATHS` of `helpers/sitePaths`
// (`getSiteOrigin()` + one of these paths), only as `<a href>` or `window.location.assign`, never in
// `navigate` or `<Link>`. `ROUTES` has no site pages (lint `no-restricted-syntax#site-paths`). The
// spec places this file in `app/router`; it lives in the base layer because helpers, components and
// pages need it and cannot import `app`. The absolute builder lives in `helpers` because the base
// layer cannot import `helpers/env` (`LAYER_GRAPH`).
const SITE_PAGE_PATHS = {
    home: '/',
    privacy: '/privacy',
    terms: '/terms',
    // The default locale has no path segment: `/`, `/ru/`.
    localeHome: (locale: SupportedLocale): string =>
        LOCALE_PATH[locale] ? `/${LOCALE_PATH[locale]}/` : '/',
} as const;

export { SITE_PAGE_PATHS };
