import {
    EXPENSE_SPLIT_MODES,
    EXPENSE_SPLIT_STATUSES,
} from 'constants/chipin';

export const EXPENSE_SPLIT_MODE_ITEMS = [
    {
        value: EXPENSE_SPLIT_MODES.EQUAL,
        labelKey: 'expenses.modal.split.equal',
    },
    {
        value: EXPENSE_SPLIT_MODES.PERCENT,
        labelKey: 'expenses.modal.split.percent',
    },
    {
        value: EXPENSE_SPLIT_MODES.AMOUNTS,
        labelKey: 'expenses.modal.split.amounts',
    },
    {
        value: EXPENSE_SPLIT_MODES.SHARES,
        labelKey: 'expenses.modal.split.shares',
    },
] as const;

export const SPLIT_SUMMARY_SEPARATOR = '/';

export const EXPENSE_SPLIT_STATUS_COLORS = {
    [EXPENSE_SPLIT_STATUSES.EXACT]: 'jade',
    [EXPENSE_SPLIT_STATUSES.UNDER]: 'red',
    [EXPENSE_SPLIT_STATUSES.OVER]: 'amber',
} as const;
