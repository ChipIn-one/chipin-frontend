// The outbox count of users for the sign-out confirm and the account-switch dialog (spec 03 §1.5,
// 03-16a part C). The auth store is on the landing path: the reader (zod, the persist codec) is
// loaded only when a count is asked for, which happens only with offline writes on.
/**
 * Pending, failed and unreadable records and conflict drafts of `userId` in IndexedDB; rejects when
 * unreadable.
 */
export const readOutboxCount = (userId: string): Promise<number> =>
    import('./outboxStore').then(({ readOutboxRecordCount }) => readOutboxRecordCount(userId));

/**
 * The records of all `userIds` together, or `null` when any of them could not be read: the caller
 * then asks without a number (the records may exist, the read cannot tell; §1.5 deletes nothing
 * without the user's answer).
 */
export const readOutboxCountsOrUnknown = (userIds: readonly string[]): Promise<number | null> =>
    Promise.all(userIds.map(readOutboxCount)).then(
        counts => counts.reduce((sum, count) => sum + count, 0),
        () => null,
    );
