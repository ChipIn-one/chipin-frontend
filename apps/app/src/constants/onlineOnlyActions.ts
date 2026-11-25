// Spec 03 §2.9: the actions that are never done offline (03-16a part C, KB NET-006), whether offline
// writes are on or off, and the expense writes (save and delete), done offline only through the
// outbox (KB NET-007, #866). Each entry point of one is wrapped in `<OnlineOnly action={…}>` or reads
// `useRequiresOnline(…)`; a test checks that every key is used by at least one of them.
export const ONLINE_ONLY_ACTIONS = {
    /** Settle-up / a payment (group and friends); the group flow is closed entirely. */
    settleUp: 'settleUp',
    /** Deleting (reverse) a settlement: the same `DELETE /ledger/entries/{id}` as an expense (C2-02). */
    settlementDelete: 'settlement.delete',
    /** Editing a settlement (C2-02). */
    settlementEdit: 'settlement.edit',
    groupCreate: 'group.create',
    /** Rename, description and the group settings (`PATCH /groups/{id}`). */
    groupUpdate: 'group.update',
    /** A group cover upload (multipart). */
    groupCover: 'group.cover',
    groupLeave: 'group.leave',
    /** Removing a participant. */
    groupKick: 'group.kick',
    groupDelete: 'group.delete',
    /** Accepting a group or friend invite (joining). */
    inviteAccept: 'invite.accept',
    /** The avatar upload (multipart). */
    avatarUpload: 'avatar.upload',
    /** User settings (`PATCH /users/self`). */
    userSettings: 'user.settings',
    friendDelete: 'friend.delete',
    logoutOtherDevices: 'logoutOtherDevices',
    /**
     * Saving an expense form (create and edit; group and personal). Blocked offline unless offline
     * writes are on and the outbox can take the write (`OFFLINE_WRITE_ACTIONS`, NET-007).
     */
    expenseSave: 'expense.save',
    /** Deleting an expense; blocked offline unless the outbox can take it, like `expenseSave`. */
    expenseDelete: 'expense.delete',
} as const;

export type OnlineOnlyAction = (typeof ONLINE_ONLY_ACTIONS)[keyof typeof ONLINE_ONLY_ACTIONS];

/** The actions the outbox takes offline when it can (`canQueueOffline`; spec 03 §2.1, NET-007). */
export const OFFLINE_WRITE_ACTIONS: ReadonlySet<OnlineOnlyAction> = new Set<OnlineOnlyAction>([
    ONLINE_ONLY_ACTIONS.expenseSave,
    ONLINE_ONLY_ACTIONS.expenseDelete,
]);
