import type { AppEvent } from 'api/activity.types';
import type { BalanceEntry } from 'api/chipin.raw.types';
import type { ActivityCategory } from 'api/chipin.types';
import { ACTIVITY_ACTIONS, type ExpenseCreatedAction } from 'constants/activity';
import { getActivityDateKey } from 'helpers/time';

const getUserExpenseValue = (
    event: Extract<AppEvent, { action: ExpenseCreatedAction }>,
    userId: string,
): number => {
    const userShareAmount = event.metadata.shares.find(share => share.userId === userId)
        ?.shareAmount ?? 0;

    if (event.metadata.payerId === userId) {
        return event.metadata.amount - userShareAmount;
    }

    return userShareAmount * -1;
};

export const getDailyExpenseSummaries = (
    events: AppEvent[],
    userId?: string,
): Record<string, BalanceEntry[]> => {
    const summaries: Record<string, BalanceEntry[]> = {};

    if (!userId) {
        return summaries;
    }

    events.forEach(event => {
        if (event.action !== ACTIVITY_ACTIONS.EXPENSE_CREATED) {
            return;
        }

        const netBalance = getUserExpenseValue(event, userId);

        if (!netBalance) {
            return;
        }

        const dateKey = getActivityDateKey(event.createdAt);
        const dateSummary = summaries[dateKey] ?? [];
        const existingEntry = dateSummary.find(entry => entry.currency === event.metadata.currency);

        if (existingEntry) {
            existingEntry.netBalance += netBalance;
        } else {
            dateSummary.push({ currency: event.metadata.currency, netBalance });
        }

        summaries[dateKey] = dateSummary;
    });

    Object.keys(summaries).forEach(dateKey => {
        summaries[dateKey] = summaries[dateKey].filter(entry => entry.netBalance !== 0);
    });

    return summaries;
};

export const getActivityChildCategory = (event?: AppEvent): ActivityCategory | undefined => {
    if (!event) {
        return undefined;
    }

    if (event.action === ACTIVITY_ACTIONS.EXPENSE_CREATED) {
        return 'expense';
    }

    if (event.action === ACTIVITY_ACTIONS.SETTLEMENT_CREATED) {
        return 'settlement';
    }

    return undefined;
};

export const getActivityLedgerEntryId = (event?: AppEvent): string | undefined => {
    if (!event) {
        return undefined;
    }

    if (
        event.action === ACTIVITY_ACTIONS.EXPENSE_CREATED ||
        event.action === ACTIVITY_ACTIONS.SETTLEMENT_CREATED
    ) {
        return event.metadata.entryId;
    }

    return undefined;
};
