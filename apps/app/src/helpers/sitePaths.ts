import { DEFAULT_LOCALE } from 'constants/locales';
import { SITE_PAGE_PATHS } from 'constants/sitePaths';

import { getSiteOrigin } from './env';
import { matchLocale } from './locale';
import { getLocalUser } from './localStorage';

// Spec 04 §2.1 (04-2g): absolute links from the app to the site pages, `getSiteOrigin()` + path.
// Functions, not values: the origin depends on the environment, resolved at call time (never at
// module load). Use them only as `<a href>` or `window.location.assign`, never in `navigate` or
// `<Link>`, and never compare them with a pathname (use `SITE_PAGE_PATHS` for that).
const SITE_PATHS = {
    home: (): string => `${getSiteOrigin()}${SITE_PAGE_PATHS.home}`,
    privacy: (): string => `${getSiteOrigin()}${SITE_PAGE_PATHS.privacy}`,
    terms: (): string => `${getSiteOrigin()}${SITE_PAGE_PATHS.terms}`,
} as const;

/**
 * The site landing path in the language of the last account on this device (spec 04 §2.3): an
 * explicit sign-out leaves for `getSiteOrigin()` + this path. Read before the user data is cleared.
 * The spec places it in `app/auth`; it lives here because `store/authStore` calls it and `store`
 * cannot import `app` (`LAYER_GRAPH`).
 */
const getLastAccountLandingPath = (): string =>
    SITE_PAGE_PATHS.localeHome(
        matchLocale(getLocalUser()?.settings.language ?? '') ?? DEFAULT_LOCALE,
    );

export { getLastAccountLandingPath, SITE_PATHS };
