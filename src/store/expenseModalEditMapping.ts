import type {
    AppEvent,
    ExpenseActivityMetadata,
    ExpenseActivityShare,
} from 'api/activity.types';
import type { SharingMode } from 'api/chipin.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { EXPENSE_SPLIT_MODES, type ExpenseSplitMode } from 'constants/chipin';
import { getActivitySubeventsView } from 'helpers/activityEvent';

import type {
    ExpenseModalEditInitialization,
    ExpenseModalGroup,
    ExpenseModalSource,
    ExpenseParticipant,
} from './expenseModalStore';
import type { ExpenseModalOriginalState } from './expenseModalUpdate';

interface ActivityExpenseEditMappingParams {
    parentEvent: AppEvent;
    childEvents: readonly AppEvent[];
    source: ExpenseModalSource;
    parentActivityId?: string;
}

type ExpenseActivityEvent = Extract<
    AppEvent,
    {
        action:
            | typeof ACTIVITY_ACTIONS.EXPENSE_CREATED
            | typeof ACTIVITY_ACTIONS.EXPENSE_UPDATED
            | typeof ACTIVITY_ACTIONS.EXPENSE_REVERSED;
    }
>;

const isExpenseActivityEvent = (event: AppEvent): event is ExpenseActivityEvent =>
    (event.action === ACTIVITY_ACTIONS.EXPENSE_CREATED ||
        event.action === ACTIVITY_ACTIONS.EXPENSE_UPDATED ||
        event.action === ACTIVITY_ACTIONS.EXPENSE_REVERSED) &&
    event.metadata?.type === 'expense';

const mergeUsers = (
    initialUsers: ExpenseParticipant[],
    additionalUsers: ExpenseParticipant[],
): ExpenseParticipant[] => {
    const users: ExpenseParticipant[] = [];
    const seenIds = new Set<string>();

    for (const user of initialUsers) {
        if (!seenIds.has(user.id)) {
            seenIds.add(user.id);
            users.push(user);
        }
    }

    for (const user of additionalUsers) {
        if (!seenIds.has(user.id)) {
            seenIds.add(user.id);
            users.push(user);
        }
    }

    return users;
};

const toExpenseParticipant = (
    share: Pick<ExpenseActivityShare, 'userId' | 'displayName'>,
): ExpenseParticipant => ({
    id: share.userId,
    displayName: share.displayName,
});

const getPayerParticipant = (
    metadata: ExpenseActivityMetadata,
): ExpenseParticipant[] => {
    if (!metadata.payerId) {
        return [];
    }

    return [
        {
            id: metadata.payerId,
            displayName: metadata.payerDisplayName,
        },
    ];
};

const getSnapshotParticipants = (
    metadata: ExpenseActivityMetadata,
): ExpenseParticipant[] => {
    const participants: ExpenseParticipant[] = [];

    for (const share of metadata.shares ?? []) {
        participants.push(toExpenseParticipant(share));
    }

    return participants;
};

const getShareAmounts = (
    shares: readonly ExpenseActivityShare[],
): Record<string, number> => {
    const amounts: Record<string, number> = {};

    for (const share of shares) {
        amounts[share.userId] = share.shareAmount;
    }

    return amounts;
};

const getActivitySharingMode = (
    metadata: ExpenseActivityMetadata,
): SharingMode => metadata.sharingMode ?? {
    type: 'EXACT',
    customShares: getShareAmounts(metadata.shares ?? []),
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
    metadata: ExpenseActivityMetadata,
): string | null => {
    if (metadata.groupName) {
        return metadata.groupName;
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
    metadata: ExpenseActivityMetadata,
    targetMode: 'group' | 'friends',
    groupId: string | null,
    snapshotUsers: ExpenseParticipant[],
): ExpenseModalSource => {
    const groupName = groupId ? getGroupName(source, groupId, metadata) : null;
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
                members: mergeUsers(group.members, snapshotUsers),
            };
        });

        if (!hasMatchingGroup) {
            groups = [
                ...groups,
                {
                    id: groupId,
                    name: groupName ?? undefined,
                    members: snapshotUsers,
                },
            ];
        }
    }

    const currentUserId = source.currentUser?.id;
    const directUsers = mergeUsers(source.knownFriends, snapshotUsers).filter(
        user => user.id !== currentUserId,
    );

    return {
        ...source,
        context: targetMode === 'group' ? 'group' : 'friends',
        groups,
        knownFriends: directUsers,
        defaultCurrency: metadata.currency,
        defaultGroupId: groupId ?? undefined,
        preferredFriendId: undefined,
    };
};

const createEqualPercentages = (
    users: ExpenseParticipant[],
): Record<string, string> => {
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
    metadata: ExpenseActivityMetadata,
    participantIds: string[],
    sharingMode: SharingMode,
): ExpenseModalOriginalState => ({
    description: metadata.description ?? null,
    amount: metadata.amount,
    date: metadata.date ?? 0,
    payerId: metadata.payerId ?? '',
    participantIds,
    currency: metadata.currency,
    category: metadata.category ?? null,
    subcategory: metadata.subcategory ?? null,
    sharingMode,
});

export const mapActivityExpenseToModalState = ({
    parentEvent,
    childEvents,
    source,
    parentActivityId,
}: ActivityExpenseEditMappingParams): ExpenseModalEditInitialization | null => {
    const activityView = getActivitySubeventsView(parentEvent, childEvents);
    const currentEvent = activityView?.currentEvent;

    if (!currentEvent || !isExpenseActivityEvent(currentEvent)) {
        return null;
    }

    const metadata = currentEvent.metadata;
    const groupId = metadata.groupId ?? currentEvent.groupId ?? null;
    const targetMode = groupId ? 'group' : 'friends';
    const sharingMode = getActivitySharingMode(metadata);
    const snapshotParticipants = getSnapshotParticipants(metadata);
    const snapshotUsers = mergeUsers(
        getPayerParticipant(metadata),
        snapshotParticipants,
    );
    const editSource = mergeEditSource(
        source,
        metadata,
        targetMode,
        groupId,
        snapshotUsers,
    );
    const availableUsers = getAvailableUsers(editSource, targetMode, groupId);
    const participantIds = new Set(snapshotParticipants.map(user => user.id));
    const includedParticipantIds = Object.fromEntries(
        availableUsers.map(user => [user.id, participantIds.has(user.id)]),
    );
    const fallbackExactValues = getShareAmounts(metadata.shares ?? []);
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
        ? (snapshotParticipants.find(
              user => user.id !== source.currentUser?.id,
          )?.id ?? '')
        : '';

    return {
        mode: 'edit',
        source: editSource,
        targetMode,
        groupId: groupId ?? '',
        selectedFriendId,
        description: metadata.description ?? '',
        amount: String(metadata.amount),
        date: metadata.date ?? 0,
        currency: metadata.currency,
        category: metadata.category ?? '',
        paidById: metadata.payerId ?? '',
        splitMode,
        percentShares,
        amountShares,
        shareWeights,
        includedParticipantIds,
        isPercentManuallyEdited: splitMode === EXPENSE_SPLIT_MODES.PERCENT,
        editContext: {
            entryId: metadata.entryId,
            groupId: groupId ?? undefined,
            groupName: groupId ? getGroupName(editSource, groupId, metadata) : null,
            parentActivityId,
            original: toOriginalState(
                metadata,
                snapshotParticipants.map(user => user.id),
                sharingMode,
            ),
        },
    };
};
