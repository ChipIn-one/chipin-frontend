export const PROJECT_NAME = 'Chipin';

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
