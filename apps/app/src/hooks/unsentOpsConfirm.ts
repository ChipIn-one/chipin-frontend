// Spec 03 §1.5, the rows `signOut()` and "sign-in of Y" (03-16a part C): a sign-out from the UI
// deletes this user's unsent operations, and those of the users a refresh switch kept on this
// device, so it asks first when there are any. The number is read from the stored outbox keys of
// those users (any tab, restored or not): pending ops, failed and unreadable records; the conflict
// drafts join it in 03-16b. A remote logout (another tab confirmed it) asks nothing. The
// account-switch question itself is asked by the auth store.
import { getKeptOutboxUsers } from 'helpers/localStorage';
import { isOfflineWritesFlagOn } from 'shared/offline/offlineWrites';
import { readOutboxCountsOrUnknown } from 'shared/offline/outboxCount';
import { cachedUserId } from 'store/sessionUser';

/** Whether a sign-out or an account switch asks about unsent operations at all (offline writes on). */
export const isUnsentOpsConfirmOn = (): boolean => isOfflineWritesFlagOn();

export interface SignOutOutboxCount {
    /** The tab's user when it was counted (N2: the answer applies only while it stays). */
    readonly userId: string | undefined;
    /** 0 → sign out, N > 0 → confirm with N, `null` (unreadable keys) → confirm without a number. */
    readonly count: number | null;
}

/** The unsent operations a sign-out would delete: this tab's user's and the kept users'. */
export const readSignOutOutboxCount = (): Promise<SignOutOutboxCount> => {
    const userId = cachedUserId();
    const userIds = [
        ...(userId === undefined ? [] : [userId]),
        ...getKeptOutboxUsers().filter(keptId => keptId !== userId),
    ];
    const counted = userIds.length === 0 ? Promise.resolve(0) : readOutboxCountsOrUnknown(userIds);

    return counted.then(count => ({ userId, count }));
};

/** N2: the tab's user is still the one counted. */
export const isSignOutUserCurrent = (userId: string | undefined): boolean =>
    cachedUserId() === userId;
