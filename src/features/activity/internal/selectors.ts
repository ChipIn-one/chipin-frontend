import type { AppEvent } from 'api/activity.types';
import type { BalanceEntry } from 'api/chipin.raw.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import {
    aggregateByCurrency,
    legacyEntryFromMoney,
    legacyExpenseBalanceChange,
} from 'entities/balance';
import { type ActivityListItem, isActivityPreview } from 'helpers/activityEvent';
import { getActivityDateKey } from 'helpers/time';
import type { Money } from 'shared/money';
import { isZero } from 'shared/money';

export const getDailyExpenseSummary = (
    events: readonly ActivityListItem[],
    userId?: string,
): Record<string, BalanceEntry[]> => {
    const changesByDate = new Map<string, Money[]>();

    if (!userId) {
        return {};
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

        const change = legacyExpenseBalanceChange(event.metadata, userId);

        if (!change || isZero(change)) {
            continue;
        }

        const dateKey = getActivityDateKey(isPreview ? item.parent.createdAt : event.createdAt);
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
