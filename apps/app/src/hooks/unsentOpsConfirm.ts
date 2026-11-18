// Spec 03 §1.5, the rows `signOut()` and "sign-in of Y" (03-16a part C): a sign-out from the UI
// deletes this user's unsent operations, so it asks first when there are any. The number is read
// from the stored outbox keys of the user (any tab, restored or not): pending ops, failed and
// unreadable records; the conflict drafts join it in 03-16b. A remote logout (another tab confirmed
// it) asks nothing. The account-switch question itself is asked by the auth store.
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';
import { readOutboxCountOrUnknown } from 'shared/offline/outboxCount';
import { cachedUserId } from 'store/sessionUser';

/** Whether a sign-out or an account switch asks about unsent operations at all (offline writes on). */
export const isUnsentOpsConfirmOn = (): boolean => isOfflineWritesFlagOn();

/**
 * The unsent operations a sign-out would delete: 0 → sign out, N > 0 → confirm with N, `null` (the
 * keys could not be read) → confirm without a number. No cached user: nothing of theirs is stored.
 */
export const readSignOutOutboxCount = (): Promise<number | null> => {
    const userId = cachedUserId();

    return userId === undefined ? Promise.resolve(0) : readOutboxCountOrUnknown(userId);
};
