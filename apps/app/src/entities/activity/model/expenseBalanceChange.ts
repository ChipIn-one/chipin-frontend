import type { Money } from 'shared/money';
import { fromUnits, sub } from 'shared/money';

import type { ExpenseActivityDetails } from './types';

/**
 * How an expense changed `userId`'s balance: the payer funded `amount − own share`, a participant
 * owes the own share. `undefined` without a share snapshot (it cannot tell what the payer funded).
 */
export const expenseBalanceChange = (
    expense: ExpenseActivityDetails,
    userId: string,
): Money | undefined => {
    if (!expense.shares) {
        return undefined;
    }
    const zero = fromUnits(0n, expense.amount);
    const share = expense.shares.find(item => item.userId === userId)?.shareAmount ?? zero;
    const funded = expense.payerId === userId ? expense.amount : zero;

    return sub(funded, share);
};
