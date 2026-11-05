import { hasAuthSessionHint } from 'helpers/localStorage';

/**
 * The user whose persisted query cache may be restored and mounted (spec 03 §1.5, C3-09): the
 * cached `LocalUser.id`, but only with a session hint. Without one (signed out, expired, never
 * signed in) the app runs on a client without persistence and reads no IndexedDB.
 */
export const persistedUserId = (localUserId: string | undefined): string | undefined =>
    localUserId !== undefined && hasAuthSessionHint() ? localUserId : undefined;
