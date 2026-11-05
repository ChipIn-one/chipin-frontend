import { hasAuthSessionHint } from 'helpers/localStorage';
import { selectAuthStatus } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { useUsersStore } from 'store/users-store';

/**
 * The user whose persisted query cache may be restored and mounted (spec 03 §1.5, C3-09): the
 * cached `LocalUser.id`, but only with a session hint. Without one (signed out, expired, never
 * signed in) the app runs on a client without persistence and reads no IndexedDB.
 */
export const persistedUserId = (localUserId: string | undefined): string | undefined =>
    localUserId !== undefined && hasAuthSessionHint() ? localUserId : undefined;

/**
 * `persistedUserId` for the app root. The hint lives in localStorage and changes together with
 * the auth status (sign-in sets it, sign-out and expiry clear it), so the root re-renders on every
 * auth transition and on a new cached id, and reads the hint in render.
 */
export const usePersistedUserId = (): string | undefined => {
    useAuthStore(selectAuthStatus);
    const localUserId = useUsersStore(state => state.localUser?.id);

    return persistedUserId(localUserId);
};
