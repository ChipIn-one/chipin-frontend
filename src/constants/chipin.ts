export const PROJECT_NAME = 'Chipin';

export const MIN_GROUP_EXPENSE_PARTICIPANTS = 2;

export const EXPENSE_SPLIT_MODES = {
    EQUAL: 'equal',
    PERCENT: 'percent',
    AMOUNTS: 'amounts',
    SHARES: 'shares',
} as const;

export type ExpenseSplitMode =
    (typeof EXPENSE_SPLIT_MODES)[keyof typeof EXPENSE_SPLIT_MODES];

export const EXPENSE_SPLIT_STATUSES = {
    EXACT: 'exact',
    UNDER: 'under',
    OVER: 'over',
} as const;

export type ExpenseSplitStatus =
    (typeof EXPENSE_SPLIT_STATUSES)[keyof typeof EXPENSE_SPLIT_STATUSES];

export const EXPENSE_SUBMIT_BLOCKERS = {
    AMOUNT: 'amount',
    TARGET: 'target',
    PARTICIPANTS: 'participants',
    PAYER: 'payer',
    PERCENT_UNDER: 'percentUnder',
    PERCENT_OVER: 'percentOver',
    AMOUNTS_UNDER: 'amountsUnder',
    AMOUNTS_OVER: 'amountsOver',
    SHARES: 'shares',
    NO_DEBT: 'noDebt',
    UNCHANGED: 'unchanged',
} as const;

export type ExpenseSubmitBlocker =
    (typeof EXPENSE_SUBMIT_BLOCKERS)[keyof typeof EXPENSE_SUBMIT_BLOCKERS];
