// The outbox count of a user for the sign-out confirm and the account-switch dialog (spec 03 §1.5,
// 03-16a part C). The auth store is on the landing path: the reader (zod, the persist codec) is
// loaded only when a count is asked for, which happens only with offline writes on.
/** Pending, failed and unreadable records of `userId` in IndexedDB; rejects when unreadable. */
export const readOutboxCount = (userId: string): Promise<number> =>
    import('./outboxStore').then(({ readOutboxRecordCount }) => readOutboxRecordCount(userId));

/**
 * `readOutboxCount`, with a failed read as `null`: the caller then asks without a number (the
 * records may exist, the read cannot tell; §1.5 deletes nothing without the user's answer).
 */
export const readOutboxCountOrUnknown = (userId: string): Promise<number | null> =>
    readOutboxCount(userId).catch(() => null);
