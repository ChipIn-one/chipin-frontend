import { EXPENSE_SPLIT_MODES, type ExpenseSplitMode } from 'constants/chipin';
import type {
    ExpenseActivityDetails,
    ExpenseActivityEvent,
    ExpenseActivityShare,
} from 'entities/activity';
import type { ExpenseDraftSharingMode, ExpensePatch } from 'entities/ledger';
import { canonicalDecimal } from 'entities/ledger';
import { getActivitySubeventsView } from 'helpers/activityEvent';
import { type Money, moneyInputText } from 'shared/money';

import type {
    ExpenseModalEditInitialization,
    ExpenseModalGroup,
    ExpenseModalSource,
    ExpenseParticipant,
} from './expenseModalTypes';
import type { ExpenseModalOriginalState } from './expenseModalUpdate';

// The editor starts from the domain expense events of an activity history (amounts as `Money`,
// percents and weights as decimal text): its form texts, and the original the edit is compared with.
interface ActivityExpenseEditMappingParams {
    parentEvent: ExpenseActivityEvent;
    childEvents: readonly ExpenseActivityEvent[];
    source: ExpenseModalSource;
    parentActivityId?: string;
}

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

const getPayerParticipant = (metadata: ExpenseActivityDetails): ExpenseParticipant[] => {
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

const getSnapshotParticipants = (metadata: ExpenseActivityDetails): ExpenseParticipant[] => {
    const participants: ExpenseParticipant[] = [];

    for (const share of metadata.shares ?? []) {
        participants.push(toExpenseParticipant(share));
    }

    return participants;
};

const getShareAmounts = (shares: readonly ExpenseActivityShare[]): Record<string, Money> => {
    const amounts: Record<string, Money> = {};

    for (const share of shares) {
        amounts[share.userId] = share.shareAmount;
    }

    return amounts;
};

const decimalValues = (values: Readonly<Record<string, string>>): Record<string, string> =>
    Object.fromEntries(
        Object.entries(values).map(([key, text]) => [key, canonicalDecimal(text) ?? text]),
    );

// Without a snapshot of the mode the expense is edited as split exactly. Percents and weights are
// kept in their shortest text ("50.0000" → "50"), as the form and the payload write them.
const getActivitySharingMode = (metadata: ExpenseActivityDetails): ExpenseDraftSharingMode => {
    const sharingMode = metadata.sharingMode;

    switch (sharingMode?.type) {
        case undefined:
            return { type: 'EXACT', customShares: getShareAmounts(metadata.shares ?? []) };
        case 'PERCENTAGE':
            return {
                type: 'PERCENTAGE',
                percentageShares: decimalValues(sharingMode.percentageShares),
            };
        case 'SHARES':
            return { type: 'SHARES', shares: decimalValues(sharingMode.shares) };
        case 'AUTO':
        case 'EXACT':
            return sharingMode;
    }
};

/** The form text of each share value: amounts as plain decimals, percents and weights as given. */
const getModeTexts = (sharingMode: ExpenseDraftSharingMode): Record<string, string> => {
    switch (sharingMode.type) {
        case 'EXACT':
            return Object.fromEntries(
                Object.entries(sharingMode.customShares).map(([key, money]) => [
                    key,
                    moneyInputText(money),
                ]),
            );
        case 'PERCENTAGE':
            return sharingMode.percentageShares;
        case 'SHARES':
            return sharingMode.shares;
        case 'AUTO':
            return {};
    }
};

const getSplitMode = (sharingMode: ExpenseDraftSharingMode): ExpenseSplitMode => {
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
    metadata: ExpenseActivityDetails,
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
    metadata: ExpenseActivityDetails,
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
        defaultCurrency: metadata.amount.currency,
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
): Record<string, Value> => Object.fromEntries(users.map(user => [user.id, value]));

const getAvailableUsers = (
    source: ExpenseModalSource,
    targetMode: 'group' | 'friends',
    groupId: string | null,
): ExpenseParticipant[] => {
    const users =
        targetMode === 'group'
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
    values: Record<string, string>,
): Record<string, string> => {
    const result: Record<string, string> = {};

    for (const user of users) {
        result[user.id] = values[user.id] ?? '0';
    }

    return result;
};

const toOriginalState = (
    metadata: ExpenseActivityDetails,
    participantIds: string[],
    sharingMode: ExpenseDraftSharingMode,
): ExpenseModalOriginalState => ({
    description: metadata.description ?? null,
    amount: metadata.amount,
    payerId: metadata.payerId ?? '',
    participantIds,
    currency: metadata.amount.currency,
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

    if (!currentEvent) {
        return null;
    }

    const metadata = currentEvent.metadata;
    const groupId = metadata.groupId ?? currentEvent.groupId ?? null;
    const targetMode = groupId ? 'group' : 'friends';
    const sharingMode = getActivitySharingMode(metadata);
    const snapshotParticipants = getSnapshotParticipants(metadata);
    const snapshotUsers = mergeUsers(getPayerParticipant(metadata), snapshotParticipants);
    const editSource = mergeEditSource(source, metadata, targetMode, groupId, snapshotUsers);
    const availableUsers = getAvailableUsers(editSource, targetMode, groupId);
    const participantIds = new Set(snapshotParticipants.map(user => user.id));
    const includedParticipantIds = Object.fromEntries(
        availableUsers.map(user => [user.id, participantIds.has(user.id)]),
    );
    const modeValues = getModeTexts(sharingMode);
    const splitMode = getSplitMode(sharingMode);
    const percentShares =
        splitMode === EXPENSE_SPLIT_MODES.PERCENT
            ? toStringRecord(availableUsers, modeValues)
            : createEqualPercentages(availableUsers.filter(user => participantIds.has(user.id)));
    const amountShares =
        splitMode === EXPENSE_SPLIT_MODES.AMOUNTS
            ? toStringRecord(availableUsers, modeValues)
            : createUserValues(availableUsers, '0');
    const shareWeights =
        splitMode === EXPENSE_SPLIT_MODES.SHARES
            ? toStringRecord(availableUsers, modeValues)
            : createUserValues(availableUsers, '1');
    const selectedFriendId =
        targetMode === 'friends'
            ? (snapshotParticipants.find(user => user.id !== source.currentUser?.id)?.id ?? '')
            : '';

    return {
        mode: 'edit',
        source: editSource,
        targetMode,
        groupId: groupId ?? '',
        selectedFriendId,
        description: metadata.description ?? '',
        amount: moneyInputText(metadata.amount),
        currency: metadata.amount.currency,
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

/**
 * Spec 03 §2.6 (03-16b): the edit form of an expense with a conflict draft opens on the expense as
 * it is now with the draft's changed fields applied on top. The original stays the expense as it
 * is now, so Save sends the draft's fields (and anything changed since) as an ordinary edit.
 */
export const applyExpensePatchToEdit = (
    initialization: ExpenseModalEditInitialization,
    patch: ExpensePatch,
): ExpenseModalEditInitialization => {
    const next: ExpenseModalEditInitialization = {
        ...initialization,
        ...(patch.description !== undefined && { description: patch.description ?? '' }),
        ...(patch.category !== undefined && { category: patch.category ?? '' }),
        ...(patch.payerId !== undefined && { paidById: patch.payerId }),
        ...(patch.currency !== undefined && { currency: patch.currency }),
        ...(patch.amount !== undefined && {
            amount: moneyInputText(patch.amount),
            currency: patch.amount.currency,
        }),
    };
    const participantIds = patch.participantIds && new Set(patch.participantIds);
    const includedParticipantIds = participantIds
        ? Object.fromEntries(
              [...new Set([...Object.keys(next.includedParticipantIds), ...participantIds])].map(
                  id => [id, participantIds.has(id)],
              ),
          )
        : next.includedParticipantIds;

    if (!patch.sharingMode) {
        return { ...next, includedParticipantIds };
    }
    const splitMode = getSplitMode(patch.sharingMode);
    const texts = getModeTexts(patch.sharingMode);

    return {
        ...next,
        includedParticipantIds,
        splitMode,
        percentShares:
            splitMode === EXPENSE_SPLIT_MODES.PERCENT
                ? { ...next.percentShares, ...texts }
                : next.percentShares,
        amountShares:
            splitMode === EXPENSE_SPLIT_MODES.AMOUNTS
                ? { ...next.amountShares, ...texts }
                : next.amountShares,
        shareWeights:
            splitMode === EXPENSE_SPLIT_MODES.SHARES
                ? { ...next.shareWeights, ...texts }
                : next.shareWeights,
        isPercentManuallyEdited:
            splitMode === EXPENSE_SPLIT_MODES.PERCENT || next.isPercentManuallyEdited,
    };
};
