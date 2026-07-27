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
    const summaryIndexes: Record<string, Record<string, BalanceEntry>> = {};

    if (!userId) {
        return summaries;
    }

    for (const event of events) {
        if (event.action !== ACTIVITY_ACTIONS.EXPENSE_CREATED) {
            continue;
        }

        const netBalance = getUserExpenseValue(event, userId);

        if (!netBalance) {
            continue;
        }

        const dateKey = getActivityDateKey(event.createdAt);
        const dateSummary = summaries[dateKey] ?? [];
        const dateIndex = summaryIndexes[dateKey] ?? {};
        const existingEntry = dateIndex[event.metadata.currency];

        if (existingEntry) {
            existingEntry.netBalance += netBalance;
        } else {
            const nextEntry = { currency: event.metadata.currency, netBalance };

            dateSummary.push(nextEntry);
            dateIndex[event.metadata.currency] = nextEntry;
        }

        summaries[dateKey] = dateSummary;
        summaryIndexes[dateKey] = dateIndex;
    }

    for (const dateKey in summaries) {
        if (!Object.prototype.hasOwnProperty.call(summaries, dateKey)) {
            continue;
        }

        summaries[dateKey] = summaries[dateKey].filter(entry => entry.netBalance !== 0);
    }

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
