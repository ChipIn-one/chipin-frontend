// The session of the guard loaders (spec 04 §2.3): the initial session check of `useCheckSignIn`,
// started and awaited outside React, so a cold load never waits for a component to mount.
import { startSessionCheck } from 'hooks/useCheckSignIn';
import { AUTH_STATUS, type UnauthReason } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

/** `authReady()` resolves no later than this after it was first asked (spec 04 §2.3, A-27). */
export const AUTH_READY_TIMEOUT_MS = 5000;

/** The session check has not answered in time: offline, backend down, or a slow refresh. */
export const UNKNOWN_OFFLINE = 'unknown_offline';

export type Session =
    | { status: typeof AUTH_STATUS.AUTHENTICATED }
    | { status: typeof AUTH_STATUS.UNAUTHENTICATED; reason: UnauthReason | undefined }
    | { status: typeof UNKNOWN_OFFLINE };

/** The live session of the auth store; still unknown reads as `UNKNOWN_OFFLINE`. */
export const readSession = (): Session => {
    const { status, unauthReason } = useAuthStore.getState();

    if (status === AUTH_STATUS.AUTHENTICATED) {
        return { status };
    }
    if (status === AUTH_STATUS.UNAUTHENTICATED) {
        return { status, reason: unauthReason };
    }
    return { status: UNKNOWN_OFFLINE };
};

// One wait per unknown session: a later call (another navigation) while the check is still
// unanswered gets the same promise, also after its timeout. Any auth change starts over.
let pending: Promise<Session> | null = null;
useAuthStore.subscribe(() => {
    pending = null;
});

const waitForSession = (): Promise<Session> =>
    new Promise<Session>(resolve => {
        const timer = setTimeout(() => {
            unsubscribe();
            resolve(readSession());
        }, AUTH_READY_TIMEOUT_MS);
        const unsubscribe = useAuthStore.subscribe(state => {
            if (state.status !== AUTH_STATUS.UNKNOWN) {
                clearTimeout(timer);
                unsubscribe();
                resolve(readSession());
            }
        });
    });

/**
 * The initial session check, started here once (not by a mounted component) and awaited: resolves
 * when the auth store leaves `unknown`, or after `AUTH_READY_TIMEOUT_MS` with `UNKNOWN_OFFLINE`.
 * Never rejects. `pathname` is the URL being loaded (a loader's `request.url`, not the one being
 * left): the OAuth callback is skipped as in `useCheckSignIn` (its page signs in itself).
 */
export const authReady = (pathname: string): Promise<Session> => {
    startSessionCheck(pathname);
    if (useAuthStore.getState().status !== AUTH_STATUS.UNKNOWN) {
        return Promise.resolve(readSession());
    }
    pending ??= waitForSession();
    return pending;
};
