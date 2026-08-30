import type { AppEvent } from 'api/activity.types';
import type { ApiExpenseLedgerEntry, ApiUserResponse } from 'api/chipin.raw.types';
import type { ApiCreateLedgerResponse, SharingMode } from 'api/chipin.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { EXPENSE_SPLIT_MODES, type ExpenseSplitMode } from 'constants/chipin';

import type {
    ExpenseModalEditInitialization,
    ExpenseModalGroup,
    ExpenseModalSource,
    ExpenseParticipant,
} from './expenseModalStore';
import type { ExpenseModalOriginalState } from './expenseModalUpdate';

interface ExpenseModalEditMappingParams {
    entry: ApiExpenseLedgerEntry;
    source: ExpenseModalSource;
    activityEvents: AppEvent[];
    parentActivityId?: string;
}

type ExpenseActivityEvent = Extract<
    AppEvent,
    {
        action:
            | typeof ACTIVITY_ACTIONS.EXPENSE_CREATED
            | typeof ACTIVITY_ACTIONS.EXPENSE_UPDATED;
    }
>;

const isExpenseActivityEvent = (event: AppEvent): event is ExpenseActivityEvent =>
    (event.action === ACTIVITY_ACTIONS.EXPENSE_CREATED ||
        event.action === ACTIVITY_ACTIONS.EXPENSE_UPDATED) &&
    event.metadata?.type === 'expense';

const mergeUsers = (
    initialUsers: ExpenseParticipant[],
    additionalUsers: ExpenseParticipant[],
): ExpenseParticipant[] => {
    const users: ExpenseParticipant[] = [];
    const seenIds = new Set<string>();

    for (const user of [...initialUsers, ...additionalUsers]) {
        if (seenIds.has(user.id)) {
            continue;
        }

        seenIds.add(user.id);
        users.push(user);
    }

    return users;
};

const toExpenseParticipant = (user: ApiUserResponse): ExpenseParticipant => ({
    id: user.id,
    displayName: user.displayName,
    picture: user.picture,
});

const getLatestExpenseActivity = (
    events: AppEvent[],
    entryId: string,
): ExpenseActivityEvent | undefined => {
    let latestEvent: ExpenseActivityEvent | undefined;

    for (const event of events) {
        if (!isExpenseActivityEvent(event)) {
            continue;
        }

        if (event.metadata.entryId !== entryId) {
            continue;
        }

        if (!latestEvent || event.seq > latestEvent.seq) {
            latestEvent = event;
        }
    }

    return latestEvent;
};

const getParticipantShares = (
    entry: ApiExpenseLedgerEntry,
): Record<string, number> => {
    const shares: Record<string, number> = {};

    for (const share of entry.expense.participantShares) {
        shares[share.userId] = share.shareAmount;
    }

    return shares;
};

const getFallbackExactMode = (entry: ApiExpenseLedgerEntry): SharingMode => ({
    type: 'EXACT',
    customShares: getParticipantShares(entry),
});

const getLatestSharingMode = (
    entry: ApiExpenseLedgerEntry,
    activityEvents: AppEvent[],
): SharingMode => {
    const latestEvent = getLatestExpenseActivity(activityEvents, entry.id);

    return latestEvent?.metadata.sharingMode ?? getFallbackExactMode(entry);
};

const getModeValues = (
    sharingMode: SharingMode,
    fallbackExactValues: Record<string, number>,
): Record<string, number> => {
    if (sharingMode.type === 'EXACT') {
        return sharingMode.customShares ?? fallbackExactValues;
    }

    if (sharingMode.type === 'PERCENTAGE') {
        return sharingMode.percentageShares ?? {};
    }

    if (sharingMode.type === 'SHARES') {
        return sharingMode.shares ?? {};
    }

    return {};
};

const getSplitMode = (sharingMode: SharingMode): ExpenseSplitMode => {
    switch (sharingMode.type) {
        case 'AUTO':
            return EXPENSE_SPLIT_MODES.EQUAL;
        case 'PERCENTAGE':
            return EXPENSE_SPLIT_MODES.PERCENT;
        case 'EXACT':
            return EXPENSE_SPLIT_MODES.AMOUNTS;
        case 'SHARES':
            return EXPENSE_SPLIT_MODES.SHARES;
    }
};

const getGroupName = (
    source: ExpenseModalSource,
    groupId: string,
    latestEvent: ExpenseActivityEvent | undefined,
): string | null => {
    if (latestEvent?.metadata.groupName) {
        return latestEvent.metadata.groupName;
    }

    for (const group of source.groups) {
        if (group.id === groupId) {
            return group.name ?? null;
        }
    }

    return null;
};

const mergeEditSource = (
    source: ExpenseModalSource,
    entry: ApiExpenseLedgerEntry,
    targetMode: 'group' | 'friends',
    groupId: string | null,
    canonicalUsers: ExpenseParticipant[],
    latestEvent: ExpenseActivityEvent | undefined,
): ExpenseModalSource => {
    const groupName = groupId ? getGroupName(source, groupId, latestEvent) : null;
    let groups: ExpenseModalGroup[] = source.groups;

    if (groupId) {
        let hasMatchingGroup = false;
        groups = source.groups.map(group => {
            if (group.id !== groupId) {
                return group;
            }

            hasMatchingGroup = true;
            return {
                ...group,
                name: group.name ?? groupName ?? undefined,
                members: mergeUsers(group.members, canonicalUsers),
            };
        });

        if (!hasMatchingGroup) {
            groups = [
                ...groups,
                {
                    id: groupId,
                    name: groupName ?? undefined,
                    members: canonicalUsers,
                },
            ];
        }
    }

    const currentUserId = source.currentUser?.id;
    const directUsers = mergeUsers(
        source.knownFriends,
        canonicalUsers,
    ).filter(user => user.id !== currentUserId);

    return {
        ...source,
        context: targetMode === 'group' ? 'group' : 'friends',
        groups,
        knownFriends: directUsers,
        defaultCurrency: entry.expense.currency,
        defaultGroupId: groupId ?? undefined,
        preferredFriendId: undefined,
    };
};

const createEqualPercentages = (users: ExpenseParticipant[]): Record<string, string> => {
    if (users.length === 0) {
        return {};
    }

    const percentage = Math.floor(100 / users.length);
    const remainder = 100 - percentage * users.length;

    return Object.fromEntries(
        users.map((user, index) => [
            user.id,
            String(index === 0 ? percentage + remainder : percentage),
        ]),
    );
};

const createUserValues = <Value extends string | boolean>(
    users: ExpenseParticipant[],
    value: Value,
): Record<string, Value> =>
    Object.fromEntries(users.map(user => [user.id, value]));

const getAvailableUsers = (
    source: ExpenseModalSource,
    targetMode: 'group' | 'friends',
    groupId: string | null,
): ExpenseParticipant[] => {
    const users = targetMode === 'group'
        ? (source.groups.find(group => group.id === groupId)?.members ?? [])
        : [source.currentUser, ...source.knownFriends].filter(
              (user): user is ExpenseParticipant => Boolean(user),
          );
    const currentUserId = source.currentUser?.id;
    const currentUser = users.find(user => user.id === currentUserId);
    const otherUsers = users.filter(user => user.id !== currentUserId);

    return currentUser ? [currentUser, ...otherUsers] : users;
};

const toStringRecord = (
    users: ExpenseParticipant[],
    values: Record<string, number>,
): Record<string, string> => {
    const result: Record<string, string> = {};

    for (const user of users) {
        result[user.id] = String(values[user.id] ?? 0);
    }

    return result;
};

const toOriginalState = (
    entry: ApiExpenseLedgerEntry,
    sharingMode: SharingMode,
): ExpenseModalOriginalState => ({
    description: entry.expense.description ?? null,
    amount: entry.expense.amount,
    date: entry.expense.date,
    payerId: entry.expense.payer.id,
    participantIds: entry.expense.participants.map(user => user.id),
    currency: entry.expense.currency,
    category: entry.expense.category ?? null,
    subcategory: entry.expense.subcategory ?? null,
    sharingMode,
});

export const mapCanonicalExpenseToModalState = ({
    entry,
    source,
    activityEvents,
    parentActivityId,
}: ExpenseModalEditMappingParams): ExpenseModalEditInitialization => {
    const groupId = entry.expense.groupId ?? entry.groupId ?? null;
    const targetMode = groupId ? 'group' : 'friends';
    const latestEvent = getLatestExpenseActivity(activityEvents, entry.id);
    const sharingMode = getLatestSharingMode(entry, activityEvents);
    const canonicalParticipants = entry.expense.participants.map(toExpenseParticipant);
    const canonicalUsers = mergeUsers(
        [toExpenseParticipant(entry.expense.payer)],
        canonicalParticipants,
    );
    const editSource = mergeEditSource(
        source,
        entry,
        targetMode,
        groupId,
        canonicalUsers,
        latestEvent,
    );
    const availableUsers = getAvailableUsers(editSource, targetMode, groupId);
    const participantIds = new Set(canonicalParticipants.map(user => user.id));
    const includedParticipantIds = Object.fromEntries(
        availableUsers.map(user => [user.id, participantIds.has(user.id)]),
    );
    const fallbackExactValues = getParticipantShares(entry);
    const modeValues = getModeValues(sharingMode, fallbackExactValues);
    const splitMode = getSplitMode(sharingMode);
    const percentShares = splitMode === EXPENSE_SPLIT_MODES.PERCENT
        ? toStringRecord(availableUsers, modeValues)
        : createEqualPercentages(
              availableUsers.filter(user => participantIds.has(user.id)),
          );
    const amountShares = splitMode === EXPENSE_SPLIT_MODES.AMOUNTS
        ? toStringRecord(availableUsers, modeValues)
        : createUserValues(availableUsers, '0');
    const shareWeights = splitMode === EXPENSE_SPLIT_MODES.SHARES
        ? toStringRecord(availableUsers, modeValues)
        : createUserValues(availableUsers, '1');
    const selectedFriendId = targetMode === 'friends'
        ? (canonicalParticipants.find(user => user.id !== source.currentUser?.id)?.id ?? '')
        : '';

    return {
        mode: 'edit',
        source: editSource,
        targetMode,
        groupId: groupId ?? '',
        selectedFriendId,
        description: entry.expense.description ?? '',
        amount: String(entry.expense.amount),
        currency: entry.expense.currency,
        category: entry.expense.category ?? '',
        paidById: entry.expense.payer.id,
        date: entry.expense.date,
        splitMode,
        percentShares,
        amountShares,
        shareWeights,
        includedParticipantIds,
        isPercentManuallyEdited: splitMode === EXPENSE_SPLIT_MODES.PERCENT,
        editContext: {
            entryId: entry.id,
            groupId: groupId ?? undefined,
            groupName: groupId ? getGroupName(editSource, groupId, latestEvent) : null,
            parentActivityId,
            original: toOriginalState(entry, sharingMode),
        },
    };
};

export const isExpenseLedgerEntry = (
    entry: ApiCreateLedgerResponse,
): entry is ApiExpenseLedgerEntry => entry.type === 'EXPENSE' && entry.expense !== null;
