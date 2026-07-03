const ACTIVITY_ACTIONS = {
    EXPENSE_CREATED: 'EXPENSE_CREATED',
    SETTLEMENT_CREATED: 'SETTLEMENT_CREATED',
    GROUP_CREATED: 'GROUP_CREATED',
    GROUP_UPDATED: 'GROUP_UPDATED',
    GROUP_DELETED: 'GROUP_DELETED',
    MEMBER_JOINED: 'MEMBER_JOINED',
    MEMBER_LEFT: 'MEMBER_LEFT',
} as const;

type ActivityAction = (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS];
type ExpenseCreatedAction = typeof ACTIVITY_ACTIONS.EXPENSE_CREATED;
type SettlementCreatedAction = typeof ACTIVITY_ACTIONS.SETTLEMENT_CREATED;
type GroupCreatedAction = typeof ACTIVITY_ACTIONS.GROUP_CREATED;
type GroupUpdatedAction = typeof ACTIVITY_ACTIONS.GROUP_UPDATED;
type GroupDeletedAction = typeof ACTIVITY_ACTIONS.GROUP_DELETED;
type MemberJoinedAction = typeof ACTIVITY_ACTIONS.MEMBER_JOINED;
type MemberLeftAction = typeof ACTIVITY_ACTIONS.MEMBER_LEFT;

export { ACTIVITY_ACTIONS };
export type {
    ActivityAction,
    ExpenseCreatedAction,
    GroupCreatedAction,
    GroupDeletedAction,
    GroupUpdatedAction,
    MemberJoinedAction,
    MemberLeftAction,
    SettlementCreatedAction,
};
