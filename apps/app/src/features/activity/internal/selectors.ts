import type { BalanceEntry } from 'api/chipin.raw.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { expenseBalanceChange } from 'entities/activity';
import { aggregateByCurrency, legacyEntryFromMoney } from 'entities/balance';
import { getActivityDateKey } from 'helpers/time';
import type { Money } from 'shared/money';
import { isZero } from 'shared/money';

import type { ActivityRow } from './rows';

export const getDailyExpenseSummary = (
    rows: readonly ActivityRow[],
    userId?: string,
): Record<string, BalanceEntry[]> => {
    const changesByDate = new Map<string, Money[]>();

    if (!userId) {
        return {};
    }

    for (const { event, original, isPreview } of rows) {
        // Flat history remains event-based; only previews represent the current chain state.
        if (
            event.action !== ACTIVITY_ACTIONS.EXPENSE_CREATED &&
            !(isPreview && event.action === ACTIVITY_ACTIONS.EXPENSE_UPDATED)
        ) {
            continue;
        }

        if (event.metadata?.type !== 'expense') {
            continue;
        }

        const change = expenseBalanceChange(event.metadata, userId);

        if (!change || isZero(change)) {
            continue;
        }

        const dateKey = getActivityDateKey(original.createdAt);
        const changes = changesByDate.get(dateKey);

        if (changes) {
            changes.push(change);
        } else {
            changesByDate.set(dateKey, [change]);
        }
    }

    // Exact per-currency sums; a day whose changes cancel out has no entry for that currency.
    return Object.fromEntries(
        Array.from(changesByDate, ([dateKey, changes]) => [
            dateKey,
            aggregateByCurrency(changes, change => change)
                .filter(({ total }) => !isZero(total))
                .map(({ total }) => legacyEntryFromMoney(total)),
        ]),
    );
};
