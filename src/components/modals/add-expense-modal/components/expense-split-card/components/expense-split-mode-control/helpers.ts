import { type ExpenseSplitStatus } from 'constants/chipin';

import { EXPENSE_SPLIT_STATUS_COLORS } from './constants';

export const getStatusColor = (status: ExpenseSplitStatus) => {
    return EXPENSE_SPLIT_STATUS_COLORS[status];
};
