const ACTIVITY_ACTIONS = {
    EXPENSE_CREATED: 'EXPENSE_CREATED',
    EXPENSE_REVERSED: 'EXPENSE_REVERSED',
    EXPENSE_TRANSFERRED_FROM: 'EXPENSE_TRANSFERRED_FROM',
    EXPENSE_TRANSFERRED_TO: 'EXPENSE_TRANSFERRED_TO',
    SETTLEMENT_CREATED: 'SETTLEMENT_CREATED',
    SETTLEMENT_REVERSED: 'SETTLEMENT_REVERSED',
    GROUP_CREATED: 'GROUP_CREATED',
    GROUP_UPDATED: 'GROUP_UPDATED',
    GROUP_DELETED: 'GROUP_DELETED',
    MEMBER_JOINED: 'MEMBER_JOINED',
    MEMBER_KICKED: 'MEMBER_KICKED',
    MEMBER_LEFT: 'MEMBER_LEFT',
} as const;

const ACTIVITY_CATEGORIES = {
    EXPENSE: 'expense',
    SETTLEMENT: 'settlement',
} as const;

type ActivityAction = (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS];
type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[keyof typeof ACTIVITY_CATEGORIES];
type ExpenseCreatedAction = typeof ACTIVITY_ACTIONS.EXPENSE_CREATED;
type ExpenseReversedAction = typeof ACTIVITY_ACTIONS.EXPENSE_REVERSED;
type ExpenseTransferredFromAction = typeof ACTIVITY_ACTIONS.EXPENSE_TRANSFERRED_FROM;
type ExpenseTransferredToAction = typeof ACTIVITY_ACTIONS.EXPENSE_TRANSFERRED_TO;
type SettlementCreatedAction = typeof ACTIVITY_ACTIONS.SETTLEMENT_CREATED;
type SettlementReversedAction = typeof ACTIVITY_ACTIONS.SETTLEMENT_REVERSED;
type GroupCreatedAction = typeof ACTIVITY_ACTIONS.GROUP_CREATED;
type GroupUpdatedAction = typeof ACTIVITY_ACTIONS.GROUP_UPDATED;
type GroupDeletedAction = typeof ACTIVITY_ACTIONS.GROUP_DELETED;
type MemberJoinedAction = typeof ACTIVITY_ACTIONS.MEMBER_JOINED;
type MemberKickedAction = typeof ACTIVITY_ACTIONS.MEMBER_KICKED;
type MemberLeftAction = typeof ACTIVITY_ACTIONS.MEMBER_LEFT;

export { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES };
export type {
    ActivityAction,
    ActivityCategory,
    ExpenseCreatedAction,
    ExpenseReversedAction,
    ExpenseTransferredFromAction,
    ExpenseTransferredToAction,
    GroupCreatedAction,
    GroupDeletedAction,
    GroupUpdatedAction,
    MemberJoinedAction,
    MemberKickedAction,
    MemberLeftAction,
    SettlementCreatedAction,
    SettlementReversedAction,
};
