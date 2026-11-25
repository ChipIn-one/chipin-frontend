import { useState } from 'react';

import { hasAuthSessionHint } from 'helpers/localStorage';
import { useTabUserId } from 'hooks/useTabUserId';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

/**
 * The user whose persisted query cache may be restored and mounted (spec 03 §1.5, C3-09): the
 * cached `LocalUser.id`, but only with a session hint. Without one (signed out, expired, never
 * signed in) a client is not created: a cold start runs on a client without persistence and reads
 * no IndexedDB. A live root keeps the client it already mounted across an expiry
 * (`nextPersistedUserId`, AUTH-077, #836).
 */
export const persistedUserId = (localUserId: string | undefined): string | undefined =>
    localUserId !== undefined && hasAuthSessionHint() ? localUserId : undefined;

/**
 * The next persisted user of a live root that has `mounted` (AUTH-077): `persistedUserId`, except
 * that an expiry or an invalid session (the hint cleared, this tab's user kept) keeps the client
 * already mounted for that user, so the shown page stays mounted under `AuthModal` (spec 04 §2.3)
 * instead of the whole tree remounting on the client without persistence. A sign-out (no tab user)
 * or another tab user drops it. Expiry keeps the user's cache anyway (spec 03 §1.5).
 */
export const nextPersistedUserId = (
    mounted: string | undefined,
    tabUserId: string | undefined,
): string | undefined => {
    const fromHint = persistedUserId(tabUserId);

    if (fromHint !== undefined) {
        return fromHint;
    }
    return mounted !== undefined && mounted === tabUserId ? mounted : undefined;
};

/**
 * `persistedUserId` for the app root. The hint lives in localStorage and changes together with
 * the auth status (sign-in sets it, sign-out and expiry clear it), so the root re-renders on every
 * auth transition and when this tab's user changes, and reads the hint in render. A cold start
 * reads only `persistedUserId` (no hint, no IndexedDB); once mounted, the user stays across an
 * expiry of the same tab user (`nextPersistedUserId`). The mounted user is state of the root, so
 * nothing outlives it.
 */
export const usePersistedUserId = (): string | undefined => {
    useAuthStore(selectAuthStatus);
    const tabUserId = useTabUserId();
    const [mounted, setMounted] = useState(() => persistedUserId(tabUserId));
    const next = nextPersistedUserId(mounted, tabUserId);

    if (next !== mounted) {
        setMounted(next);
    }
    return next;
};
