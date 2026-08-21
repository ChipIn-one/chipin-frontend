import type { AppEvent } from 'api/activity.types';
import type { BalanceEntry } from 'api/chipin.raw.types';
import { ACTIVITY_ACTIONS, type ExpenseCreatedAction } from 'constants/activity';
import { getActivityDateKey } from 'helpers/time';

interface DailyBalance extends BalanceEntry {
    dateKey: string;
}

const getUserExpenseBalanceChange = (
    event: Extract<AppEvent, { action: ExpenseCreatedAction }>,
    userId: string,
): number => {
    const userShareAmount =
        event.metadata?.shares?.find(share => share.userId === userId)?.shareAmount ?? 0;

    if (event.metadata.payerId === userId) {
        return event.metadata.amount - userShareAmount;
    }

    return userShareAmount * -1;
};

export const getDailyExpenseSummary = (
    events: AppEvent[],
    userId?: string,
): Record<string, BalanceEntry[]> => {
    const summaries: Record<string, BalanceEntry[]> = {};
    const balances = new Map<string, DailyBalance>();

    if (!userId) {
        return summaries;
    }

    for (const event of events) {
        if (event.action !== ACTIVITY_ACTIONS.EXPENSE_CREATED) {
            continue;
        }

        if (!event.metadata) {
            continue;
        }

        const netBalance = getUserExpenseBalanceChange(event, userId);

        if (!netBalance) {
            continue;
        }

        const dateKey = getActivityDateKey(event.createdAt);
        const { currency } = event.metadata;
        const balanceKey = `${dateKey}:${currency}`;
        const existingBalance = balances.get(balanceKey);

        if (existingBalance) {
            existingBalance.netBalance += netBalance;
        } else {
            balances.set(balanceKey, { dateKey, currency, netBalance });
        }
    }

    for (const { dateKey, currency, netBalance } of balances.values()) {
        const dateSummary = summaries[dateKey] ?? [];

        if (netBalance) {
            dateSummary.push({ currency, netBalance });
        }

        summaries[dateKey] = dateSummary;
    }

    return summaries;
};
