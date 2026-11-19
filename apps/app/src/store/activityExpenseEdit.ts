// The expense editor opened from an expense history (ACT-004): its state is built from the latest
// domain event of the history the page shows, without a ledger read.
import type { ActivityEvent, ExpenseActivityEvent } from 'entities/activity';
import { conflictDraftPatch } from 'entities/ledger';
import { userCurrency, userDefaultCategory, userSkipCategory } from 'entities/users';
import { getLocalUser } from 'helpers/localStorage';

import { applyExpensePatchToEdit, mapActivityExpenseToModalState } from './expenseModalEditMapping';
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
        parentEvent,
        childEvents: childEvents.filter(isExpenseEvent),
        source: getExpenseEditSource(),
        parentActivityId,
    });
};

/**
 * Spec 03 §2.6 (03-16b): any edit of an expense with a conflict draft opens on the draft, its
 * fields applied on top of the expense as it is now (`isDraft`). Without a readable draft (or with
 * offline writes off) the initialization is returned as it is.
 */
export const withConflictDraft = (
    initialization: ExpenseModalEditInitialization,
): { initialization: ExpenseModalEditInitialization; isDraft: boolean } => {
    const patch = conflictDraftPatch(initialization.editContext.entryId, initialization.currency);

    return patch
        ? { initialization: applyExpensePatchToEdit(initialization, patch), isDraft: true }
        : { initialization, isDraft: false };
};
