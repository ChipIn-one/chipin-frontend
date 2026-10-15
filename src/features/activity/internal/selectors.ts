import type { AppEvent, ExpenseActivityMetadata } from 'api/activity.types';
import type { BalanceEntry } from 'api/chipin.raw.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { isActivityPreview, type ActivityListItem } from 'helpers/activityEvent';
import { normalizeApiMoneyAmount } from 'helpers/numbers';
import { getActivityDateKey } from 'helpers/time';

interface DailyBalance extends BalanceEntry {
    dateKey: string;
}

const getUserExpenseBalanceChange = (
    metadata: ExpenseActivityMetadata,
    userId: string,
): number | undefined => {
    // A missing share snapshot cannot establish how much the payer funded for others.
    if (!metadata.shares) {
        return undefined;
    }

    const userShareAmount =
        metadata.shares.find(share => share.userId === userId)?.shareAmount ?? 0;

    if (metadata.payerId === userId) {
        return metadata.amount - userShareAmount;
    }

    return userShareAmount * -1;
};

export const getDailyExpenseSummary = (
    events: readonly ActivityListItem[],
    userId?: string,
): Record<string, BalanceEntry[]> => {
    const summaries: Record<string, BalanceEntry[]> = {};
    const balances = new Map<string, DailyBalance>();

    if (!userId) {
        return summaries;
    }

    for (const item of events) {
        const isPreview = isActivityPreview(item);
        const event: AppEvent = isPreview ? item.lastEvent : item;

        // Flat history remains event-based; only previews represent the current chain state.
        if (
            event.action !== ACTIVITY_ACTIONS.EXPENSE_CREATED &&
            !(isPreview && event.action === ACTIVITY_ACTIONS.EXPENSE_UPDATED)
        ) {
            continue;
        }

        if (!event.metadata) {
            continue;
        }

        const netBalance = getUserExpenseBalanceChange(event.metadata, userId);

        if (!netBalance) {
            continue;
        }

        const dateKey = getActivityDateKey(isPreview ? item.parent.createdAt : event.createdAt);
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
        // Normalize only the final UI sum, not each individual financial contribution.
        const normalizedBalance = normalizeApiMoneyAmount(netBalance);

        if (normalizedBalance) {
            dateSummary.push({ currency, netBalance: normalizedBalance });
        }

        summaries[dateKey] = dateSummary;
    }

    return summaries;
};
