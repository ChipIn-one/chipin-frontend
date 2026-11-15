// The expense editor opened from an expense history (ACT-004): its state is built from the latest
// event of the history the page shows, without a ledger read. The editor still starts from the
// legacy event shape, so the domain events are carried back by `legacyExpenseEvent`.
// TODO(03-14b): the editor starts from the domain events.
import type { ActivityEvent, ExpenseActivityEvent } from 'entities/activity';
import { legacyExpenseEvent } from 'entities/balance';
import { userCurrency, userDefaultCategory, userSkipCategory } from 'entities/users';
import { getLocalUser } from 'helpers/localStorage';

import { mapActivityExpenseToModalState } from './expenseModalEditMapping';
import type { ExpenseModalEditInitialization, ExpenseModalSource } from './expenseModalStore';
import { getCachedGroups } from './groupsList';
import { getCachedKnownUsers, getCachedSelfUser } from './sessionUser';
import { useUiPrefsStore } from './ui-prefs';

export interface PrepareExpenseEditParams {
    parentEvent: ActivityEvent;
    childEvents: readonly ActivityEvent[];
    parentActivityId?: string;
}

const getExpenseEditSource = (): ExpenseModalSource => {
    const groups = getCachedGroups() ?? [];
    const currentUser = getCachedSelfUser() ?? null;
    // The self query's settings once it has data, else the cached user's (as the UI reads them).
    const settings = currentUser?.settings ?? getLocalUser()?.settings ?? null;

    return {
        context: 'dashboard',
        currentUser,
        defaultCurrency: userCurrency(settings),
        defaultCategory: userDefaultCategory(settings),
        skipCategory: userSkipCategory(settings),
        groups: groups.map(group => ({
            id: group.id,
            name: group.name,
            members: group.members.map(member => member.user),
        })),
        knownFriends: getCachedKnownUsers()?.map(friend => friend.user) ?? [],
        defaultGroupId: useUiPrefsStore.getState().lastGroupId ?? groups[0]?.id,
    };
};

const isExpenseEvent = (event: ActivityEvent): event is ExpenseActivityEvent =>
    event.metadata?.type === 'expense';

/** The editor state for the expense of `parentEvent` as of its latest event; null if not one. */
export const prepareExpenseEdit = ({
    parentEvent,
    childEvents,
    parentActivityId,
}: PrepareExpenseEditParams): ExpenseModalEditInitialization | null => {
    if (!isExpenseEvent(parentEvent)) {
        return null;
    }

    return mapActivityExpenseToModalState({
        parentEvent: legacyExpenseEvent(parentEvent),
        childEvents: childEvents.filter(isExpenseEvent).map(legacyExpenseEvent),
        source: getExpenseEditSource(),
        parentActivityId,
    });
};
