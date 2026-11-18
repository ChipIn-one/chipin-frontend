// Spec 03 §2.9: the actions that are never done offline (03-16a part C). Each entry point of one is
// wrapped in `<OnlineOnly action={…}>` or reads `useRequiresOnline(…)`; a test checks that every key
// is used by at least one of them.
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
} as const;

export type OnlineOnlyAction = (typeof ONLINE_ONLY_ACTIONS)[keyof typeof ONLINE_ONLY_ACTIONS];
