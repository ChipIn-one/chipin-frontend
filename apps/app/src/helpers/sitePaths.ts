import type { SupportedLocale } from 'constants/locales';
import { SITE_PAGE_PATHS } from 'constants/sitePaths';

import { getSiteOrigin } from './env';

// Spec 04 §2.1 (04-2g): absolute links from the app to the site pages, `getSiteOrigin()` + path.
// Functions, not values: the origin depends on the environment, resolved at call time (never at
// module load). Use them only as `<a href>` or `window.location.assign`, never in `navigate` or
// `<Link>`, and never compare them with a pathname (use `SITE_PAGE_PATHS` for that).
const SITE_PATHS = {
    home: (): string => `${getSiteOrigin()}${SITE_PAGE_PATHS.home}`,
    privacy: (): string => `${getSiteOrigin()}${SITE_PAGE_PATHS.privacy}`,
    terms: (): string => `${getSiteOrigin()}${SITE_PAGE_PATHS.terms}`,
    localeHome: (locale: SupportedLocale): string =>
        `${getSiteOrigin()}${SITE_PAGE_PATHS.localeHome(locale)}`,
} as const;

export { SITE_PATHS };
