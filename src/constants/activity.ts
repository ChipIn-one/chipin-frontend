const ACTIVITY_ACTIONS = {
    EXPENSE_CREATED: 'EXPENSE_CREATED',
    EXPENSE_UPDATED: 'EXPENSE_UPDATED',
    EXPENSE_REVERSED: 'EXPENSE_REVERSED',
    EXPENSE_TRANSFERRED_FROM: 'EXPENSE_TRANSFERRED_FROM',
    EXPENSE_TRANSFERRED_TO: 'EXPENSE_TRANSFERRED_TO',
    SETTLEMENT_CREATED: 'SETTLEMENT_CREATED',
    SETTLEMENT_UPDATED: 'SETTLEMENT_UPDATED',
    SETTLEMENT_REVERSED: 'SETTLEMENT_REVERSED',
    GROUP_CREATED: 'GROUP_CREATED',
    GROUP_UPDATED: 'GROUP_UPDATED',
    GROUP_DELETED: 'GROUP_DELETED',
    GROUP_DEACTIVATED: 'GROUP_DEACTIVATED',
    OWNERSHIP_TRANSFERRED: 'OWNERSHIP_TRANSFERRED',
    MEMBER_JOINED: 'MEMBER_JOINED',
    MEMBER_KICKED: 'MEMBER_KICKED',
    MEMBER_LEFT: 'MEMBER_LEFT',
    MEMBERS_ADDED: 'MEMBERS_ADDED',
} as const;

const ACTIVITY_CATEGORIES = {
    EXPENSE: 'expense',
    SETTLEMENT: 'settlement',
} as const;

type ActivityAction = (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS];
type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[keyof typeof ACTIVITY_CATEGORIES];
type ExpenseCreatedAction = typeof ACTIVITY_ACTIONS.EXPENSE_CREATED;
type ExpenseUpdatedAction = typeof ACTIVITY_ACTIONS.EXPENSE_UPDATED;
type ExpenseReversedAction = typeof ACTIVITY_ACTIONS.EXPENSE_REVERSED;
type ExpenseTransferredFromAction = typeof ACTIVITY_ACTIONS.EXPENSE_TRANSFERRED_FROM;
type ExpenseTransferredToAction = typeof ACTIVITY_ACTIONS.EXPENSE_TRANSFERRED_TO;
type SettlementCreatedAction = typeof ACTIVITY_ACTIONS.SETTLEMENT_CREATED;
type SettlementUpdatedAction = typeof ACTIVITY_ACTIONS.SETTLEMENT_UPDATED;
type SettlementReversedAction = typeof ACTIVITY_ACTIONS.SETTLEMENT_REVERSED;
type GroupCreatedAction = typeof ACTIVITY_ACTIONS.GROUP_CREATED;
type GroupUpdatedAction = typeof ACTIVITY_ACTIONS.GROUP_UPDATED;
type GroupDeletedAction = typeof ACTIVITY_ACTIONS.GROUP_DELETED;
type GroupDeactivatedAction = typeof ACTIVITY_ACTIONS.GROUP_DEACTIVATED;
type OwnershipTransferredAction = typeof ACTIVITY_ACTIONS.OWNERSHIP_TRANSFERRED;
type MemberJoinedAction = typeof ACTIVITY_ACTIONS.MEMBER_JOINED;
type MemberKickedAction = typeof ACTIVITY_ACTIONS.MEMBER_KICKED;
type MemberLeftAction = typeof ACTIVITY_ACTIONS.MEMBER_LEFT;
type MembersAddedAction = typeof ACTIVITY_ACTIONS.MEMBERS_ADDED;

export { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES };
export type {
    ActivityAction,
    ActivityCategory,
    ExpenseCreatedAction,
    ExpenseReversedAction,
    ExpenseTransferredFromAction,
    ExpenseTransferredToAction,
    ExpenseUpdatedAction,
    GroupCreatedAction,
    GroupDeactivatedAction,
    GroupDeletedAction,
    GroupUpdatedAction,
    MemberJoinedAction,
    MemberKickedAction,
    MemberLeftAction,
    MembersAddedAction,
    OwnershipTransferredAction,
    SettlementCreatedAction,
    SettlementReversedAction,
    SettlementUpdatedAction,
};
