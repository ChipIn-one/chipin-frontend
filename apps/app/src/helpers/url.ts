import type { AuthService } from 'constants/auth.types';
import { ROUTES } from 'constants/routes';
import { SITE_PATHS } from 'constants/sitePaths';
import { isSupportedLocale } from 'helpers/locale';
import { resolveRegistrationLocale } from 'helpers/publicRoutes';

import { getChipInApiUrl, getChipInAppUrl } from './env';

/** Where a sign-in returns to when `returnTo` is missing or rejected. */
export const DEFAULT_RETURN_TO = ROUTES.DASHBOARD;

// Control characters: browsers strip or reinterpret them in URLs (`/\t/evil` is `//evil`).
// eslint-disable-next-line no-control-regex -- control characters are exactly what is rejected
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
// The pages a sign-in never returns to: the OAuth callback and `/login` itself (no loop).
const NO_RETURN_PATHS: readonly string[] = [ROUTES.OAUTH_CALLBACK, ROUTES.LOGIN];

/** A longer `returnTo` is rejected: no app path comes close, and it bounds the work below. */
const MAX_RETURN_TO_LENGTH = 2048;

/** `value` percent-decoded until it stops changing (at most 3 times), or null if malformed. */
const decodeRepeatedly = (value: string): string | null => {
    let current = value;

    for (let step = 0; step < 3; step++) {
        let decoded: string;
        try {
            decoded = decodeURIComponent(current);
        } catch {
            return null;
        }
        if (decoded === current) {
            return current;
        }
        current = decoded;
    }
    return current;
};

/** A local path: one leading `/` not followed by `/` or `\`, and no backslash anywhere. */
const isLocalPath = (value: string): boolean =>
    value.startsWith('/') && !/^\/[/\\]/.test(value) && !value.includes('\\');

/** `value` and its percent-decoded form are local paths without control characters. */
const isSafeLocalPath = (value: string): boolean => {
    const decoded = decodeRepeatedly(value);

    return (
        decoded !== null &&
        !CONTROL_CHARACTERS.test(value) &&
        !CONTROL_CHARACTERS.test(decoded) &&
        isLocalPath(value) &&
        isLocalPath(decoded)
    );
};

/**
 * The one `returnTo` validator of the sign-in flows (`/login` and `/oauth/callback`, spec 04 §2.3):
 * `returnTo` must be a same-origin app path. Rejected (→ `DEFAULT_RETURN_TO`): empty, absolute
 * URLs and any scheme (`https:`, `javascript:`), protocol-relative `//host` and backslash forms
 * (`/\host`, `\\host`), the same hidden by percent-encoding (`/%2F%2Fhost`, `/%5Chost`), whitespace
 * or control characters anywhere, longer than `MAX_RETURN_TO_LENGTH`, and the OAuth callback or
 * `/login` itself (any case, any trailing slash). The result is the normalized
 * `pathname + search + hash`, checked again: dot segments can normalize to `//host`
 * (`/a/..//host`, `/%2e%2e//host`). Never log the value: it may carry an invite token (AGENTS.md
 * item 13).
 */
export const resolveOAuthReturnTo = (returnTo: string | null, origin: string): string => {
    // Raw: no whitespace at all; decoded: no control characters (a decoded space is fine).
    if (
        !returnTo ||
        returnTo.length > MAX_RETURN_TO_LENGTH ||
        /\s/.test(returnTo) ||
        !isSafeLocalPath(returnTo)
    ) {
        return DEFAULT_RETURN_TO;
    }
    const decoded = decodeRepeatedly(returnTo) ?? '';

    try {
        const url = new URL(returnTo, origin);
        // The router matches paths case-insensitively and decoded, with or without a trailing `/`.
        const isNoReturnPath = [url.pathname, new URL(decoded, origin).pathname].some(pathname =>
            NO_RETURN_PATHS.includes(pathname.replace(/\/+$/, '').toLowerCase()),
        );

        if (url.origin !== origin || isNoReturnPath) {
            return DEFAULT_RETURN_TO;
        }

        const resolved = `${url.pathname}${url.search}${url.hash}`;

        return isSafeLocalPath(resolved) ? resolved : DEFAULT_RETURN_TO;
    } catch {
        return DEFAULT_RETURN_TO;
    }
};

/**
 * `/login` that returns to `returnTo` (`pathname + search` of the protected URL, the invite token of
 * a join route included). `/login` validates it again (`resolveOAuthReturnTo`); never log it.
 */
export const loginPathFor = (returnTo: string): string =>
    `${ROUTES.LOGIN}?returnTo=${encodeURIComponent(returnTo)}`;

/** Options of a sign-in started from `/login`: its validated `returnTo` and `?locale`. */
export interface SocialAuthOptions {
    returnTo?: string;
    locale?: string | null;
}

export const getSocialAuthUrl = (provider: AuthService, options: SocialAuthOptions = {}) => {
    const apiUrl = getChipInApiUrl();

    const { origin, pathname, search, hash } = window.location;

    const returnTo =
        options.returnTo ??
        (pathname === SITE_PATHS.home ? DEFAULT_RETURN_TO : `${pathname}${search}${hash}`);
    const callbackUrl = new URL(ROUTES.OAUTH_CALLBACK, origin);
    callbackUrl.searchParams.set('returnTo', returnTo);

    const query = new URLSearchParams({ redirect_to: callbackUrl.toString() });
    if (provider === 'google') {
        // Spec 04 §2.10: `?locale` of `/login` (from the site) is taken only if it is a supported
        // locale code; otherwise the locale of the public page, then the browser languages.
        const requested = options.locale ?? '';
        query.set(
            'locale',
            isSupportedLocale(requested) ? requested : resolveRegistrationLocale(pathname),
        );
    }

    return `${apiUrl}auth/login/${provider}?${query.toString()}`;
};

export const buildFriendInviteLink = ({ inviteToken }: { inviteToken: string }) =>
    `${getChipInAppUrl()}${ROUTES.FRIENDS_JOIN}/${inviteToken}`;

export const buildGroupInviteLink = ({ inviteToken }: { inviteToken: string }) =>
    `${getChipInAppUrl()}${ROUTES.GROUP_JOIN}/${inviteToken}`;

export const buildActivitySubeventsRoute = (parentActivityId: string) =>
    `${ROUTES.ACTIVITY}/${parentActivityId}`;
