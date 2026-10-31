import type { CreateLedgerEntryParams, SharingMode } from 'api/chipin.types';
import {
    EXPENSE_SPLIT_MODES,
    EXPENSE_SPLIT_STATUSES,
    EXPENSE_SUBMIT_BLOCKERS,
    type ExpenseSplitStatus,
    type ExpenseSubmitBlocker,
    MIN_GROUP_EXPENSE_PARTICIPANTS,
} from 'constants/chipin';
import { MONEY_INPUT_PRECISION, roundHalfUp } from 'helpers/numbers';

import type { ExpenseModalState, ExpenseModalStore, ExpenseParticipant } from './expenseModalStore';
import { buildExpenseUpdateParams } from './expenseModalUpdate';

type ShareColor = 'gray' | 'jade' | 'red';

export interface ExpenseSubmitFeedback {
    reason: ExpenseSubmitBlocker;
    current?: number;
    required?: number;
    difference?: number;
}

const putCurrentUserFirst = (users: ExpenseParticipant[], currentUserId?: string) => {
    const otherUsers: ExpenseParticipant[] = [];
    let currentUser: ExpenseParticipant | undefined;

    for (const user of users) {
        if (user.id === currentUserId) {
            currentUser = user;
        } else {
            otherUsers.push(user);
        }
    }

    if (!currentUser) {
        return users;
    }

    return [currentUser, ...otherUsers];
};

const getDirectExpenseUsers = (state: ExpenseModalState) => {
    const currentUser = state.source.currentUser;

    if (!state.source.preferredFriendId) {
        return currentUser
            ? [currentUser, ...state.source.knownFriends]
            : state.source.knownFriends;
    }

    const selectedFriend = state.source.knownFriends.find(
        friend => friend.id === state.selectedFriendId,
    );

    return [currentUser, selectedFriend].filter((user): user is ExpenseParticipant =>
        Boolean(user),
    );
};

export const selectUsers = (state: ExpenseModalState) => {
    const users =
        state.targetMode === 'friends'
            ? getDirectExpenseUsers(state)
            : (state.source.groups.find(group => group.id === state.groupId)?.members ?? []);

    return putCurrentUserFirst(users, state.source.currentUser?.id);
};

export const selectIncludedUsers = (state: ExpenseModalState) => {
    const users = selectUsers(state);

    return users.filter(user => state.includedParticipantIds[user.id] !== false);
};

export const selectPayerUsers = (state: ExpenseModalStore) =>
    state.targetMode === 'friends' ? selectIncludedUsers(state) : selectUsers(state);

const getPayerId = (state: ExpenseModalStore, users: ExpenseParticipant[]) => {
    if (users.some(user => user.id === state.paidById)) {
        return state.paidById;
    }

    if (state.targetMode === 'friends' && state.source.currentUser) {
        return state.source.currentUser.id;
    }

    return users[0]?.id ?? '';
};

export const selectPayerId = (state: ExpenseModalStore) =>
    getPayerId(state, selectPayerUsers(state));

const getTotalAmount = (state: ExpenseModalStore) => {
    const amount = Number(state.amount);

    return Number.isFinite(amount) ? amount : 0;
};

const getUserAmount = (
    state: ExpenseModalStore,
    userId: string,
    includedUserCount: number,
    totalAmount: number,
    totalShares: number,
    isIncluded: boolean,
) => {
    if (!isIncluded) {
        return 0;
    }

    switch (state.splitMode) {
        case EXPENSE_SPLIT_MODES.EQUAL:
            return roundHalfUp(totalAmount / includedUserCount, MONEY_INPUT_PRECISION);
        case EXPENSE_SPLIT_MODES.PERCENT:
            return roundHalfUp(
                (totalAmount * (Number(state.percentShares[userId]) || 0)) / 100,
                MONEY_INPUT_PRECISION,
            );
        case EXPENSE_SPLIT_MODES.AMOUNTS:
            return roundHalfUp(Number(state.amountShares[userId]) || 0, MONEY_INPUT_PRECISION);
        case EXPENSE_SPLIT_MODES.SHARES:
            return totalShares > 0
                ? roundHalfUp(
                      (totalAmount * (Number(state.shareWeights[userId]) || 0)) / totalShares,
                      MONEY_INPUT_PRECISION,
                  )
                : 0;
    }
};

const getSplitStatus = (assignedAmount: number, totalAmount: number): ExpenseSplitStatus => {
    if (assignedAmount === totalAmount) {
        return EXPENSE_SPLIT_STATUSES.EXACT;
    }

    return assignedAmount < totalAmount
        ? EXPENSE_SPLIT_STATUSES.UNDER
        : EXPENSE_SPLIT_STATUSES.OVER;
};

const calculateSplit = (state: ExpenseModalStore) => {
    const users = selectUsers(state);
    const includedUsers: ExpenseParticipant[] = [];
    const totalAmount = getTotalAmount(state);
    const currentUserId = state.source.currentUser?.id;
    const includedUserIds = new Set<string>();
    const userIds: string[] = [];
    const usersById = new Map<string, ExpenseParticipant>();
    let directFriend: ExpenseParticipant | undefined;
    let totalPercent = 0;
    let totalCustomAmount = 0;
    let totalShares = 0;

    for (const user of users) {
        userIds.push(user.id);
        usersById.set(user.id, user);

        if (state.includedParticipantIds[user.id] === false) {
            continue;
        }

        includedUsers.push(user);
        includedUserIds.add(user.id);
        totalPercent += Number(state.percentShares[user.id]) || 0;
        totalCustomAmount += Number(state.amountShares[user.id]) || 0;
        totalShares += Number(state.shareWeights[user.id]) || 0;

        if (user.id !== currentUserId) {
            directFriend = user;
        }
    }

    const isDirectExpenseReady =
        state.targetMode !== 'friends' ||
        (includedUsers.length === 2 && Boolean(currentUserId && includedUserIds.has(currentUserId)));
    let assignedAmount = totalAmount;

    if (!isDirectExpenseReady) {
        assignedAmount = 0;
    } else if (state.splitMode === EXPENSE_SPLIT_MODES.EQUAL) {
        assignedAmount = includedUsers.length > 0 ? totalAmount : 0;
    } else if (state.splitMode === EXPENSE_SPLIT_MODES.PERCENT) {
        assignedAmount = roundHalfUp((totalAmount * totalPercent) / 100, MONEY_INPUT_PRECISION);
    } else if (state.splitMode === EXPENSE_SPLIT_MODES.AMOUNTS) {
        assignedAmount = roundHalfUp(totalCustomAmount, MONEY_INPUT_PRECISION);
    } else if (state.splitMode === EXPENSE_SPLIT_MODES.SHARES) {
        assignedAmount = totalShares > 0 ? totalAmount : 0;
    }

    return {
        includedUsers,
        totalAmount,
        assignedAmount,
        status: getSplitStatus(assignedAmount, totalAmount),
        progressPercent: totalAmount > 0 ? (assignedAmount / totalAmount) * 100 : 0,
        yourShareAmount:
            isDirectExpenseReady && currentUserId
                ? getUserAmount(
                      state,
                      currentUserId,
                      includedUsers.length,
                      totalAmount,
                      totalShares,
                      includedUserIds.has(currentUserId),
                  )
                : 0,
        isValid:
            (state.splitMode !== EXPENSE_SPLIT_MODES.PERCENT || totalPercent === 100) &&
            (state.splitMode !== EXPENSE_SPLIT_MODES.AMOUNTS ||
                Math.abs(totalCustomAmount - totalAmount) < 0.001) &&
            (state.splitMode !== EXPENSE_SPLIT_MODES.SHARES || totalShares > 0),
        totalPercent,
        totalCustomAmount,
        totalShares,
        includedUserIds,
        directFriend,
        userIds,
        users,
        usersById,
    };
};

let cachedSplitState: ExpenseModalStore | undefined;
let cachedSplit: ReturnType<typeof calculateSplit> | undefined;

const getSplit = (state: ExpenseModalStore) => {
    if (cachedSplitState === state && cachedSplit) {
        return cachedSplit;
    }

    cachedSplitState = state;
    cachedSplit = calculateSplit(state);

    return cachedSplit;
};

export const selectUserIds = (state: ExpenseModalStore) => getSplit(state).userIds;

export const selectExpenseParticipant = (state: ExpenseModalStore, userId: string) =>
    getSplit(state).usersById.get(userId);

export const selectAllUsersSelected = (state: ExpenseModalStore) => {
    const users = selectUsers(state);

    return users.length > 0 && users.every(user => state.includedParticipantIds[user.id] !== false);
};

export const selectUserAmount = (state: ExpenseModalStore, userId: string) => {
    const split = getSplit(state);

    return getUserAmount(
        state,
        userId,
        split.includedUsers.length,
        split.totalAmount,
        split.totalShares,
        split.includedUserIds.has(userId),
    );
};

export const selectIsUserLocked = (state: ExpenseModalStore, userId: string) =>
    state.targetMode === 'friends' &&
    (Boolean(state.source.preferredFriendId) || userId === state.source.currentUser?.id);

export const selectIsDirectExpense = (state: ExpenseModalStore) =>
    state.targetMode === 'friends' && getSplit(state).users.length === 2;

export const selectAmountStep = (state: ExpenseModalStore) =>
    Math.max(1, Math.round(getTotalAmount(state) / 100));

export const selectYourShareColor = (state: ExpenseModalStore): ShareColor => {
    const currentUserId = state.source.currentUser?.id;
    const payerId = selectPayerId(state);

    if (!currentUserId || !payerId) {
        return 'gray';
    }

    return payerId === currentUserId ? 'jade' : 'red';
};

const isDirectExpenseValid = (
    state: ExpenseModalStore,
    split: ReturnType<typeof getSplit>,
    payerId: string,
) => {
    if (state.targetMode !== 'friends') {
        return true;
    }

    const currentUserId = state.source.currentUser?.id;

    return (
        Boolean(currentUserId) &&
        split.includedUsers.length === 2 &&
        split.includedUserIds.size === 2 &&
        Boolean(currentUserId && split.includedUserIds.has(currentUserId)) &&
        split.includedUserIds.has(payerId) &&
        Boolean(
            split.directFriend &&
                state.source.knownFriends.some(
                    knownFriend => knownFriend.id === split.directFriend?.id,
                ),
        )
    );
};

/**
 * Mirrors the backend's largest-remainder allocation at four decimal places.
 * In a two-participant split, equal remainders go to the first participant.
 */
const getDirectNonPayerUnits = (
    state: ExpenseModalStore,
    split: ReturnType<typeof getSplit>,
    payerId: string,
): number | null => {
    if (
        state.targetMode !== 'friends' ||
        split.totalAmount <= 0 ||
        !split.isValid ||
        !isDirectExpenseValid(state, split, payerId)
    ) {
        return null;
    }

    const [first, second] = split.includedUsers;

    if (!first || !second) {
        return null;
    }

    const nonPayerId = payerId === first.id ? second.id : first.id;

    if (state.splitMode === EXPENSE_SPLIT_MODES.AMOUNTS) {
        const amount = Number(state.amountShares[nonPayerId] ?? 0);
        return Number.isFinite(amount) && amount >= 0
            ? Math.round(amount * 10_000)
            : null;
    }

    const getWeight = (userId: string): number => {
        switch (state.splitMode) {
            case EXPENSE_SPLIT_MODES.EQUAL:
                return 1;
            case EXPENSE_SPLIT_MODES.PERCENT:
                return Number(state.percentShares[userId] ?? 0);
            case EXPENSE_SPLIT_MODES.SHARES:
                return Number(state.shareWeights[userId] ?? 0);
            default:
                return 0;
        }
    };

    const firstWeight = getWeight(first.id);
    const secondWeight = getWeight(second.id);
    const totalWeight = firstWeight + secondWeight;

    if (
        !Number.isFinite(totalWeight) ||
        !Number.isFinite(firstWeight) ||
        !Number.isFinite(secondWeight) ||
        firstWeight < 0 ||
        secondWeight < 0 ||
        totalWeight <= 0
    ) {
        return null;
    }

    // A zero counterparty weight creates no debt regardless of total magnitude.
    // In particular, do not skip this check when amount * 10_000 is unsafe.
    const nonPayerWeight = nonPayerId === first.id ? firstWeight : secondWeight;

    if (nonPayerWeight === 0) {
        return 0;
    }

    const totalUnits = Math.round(split.totalAmount * 10_000);

    if (!Number.isSafeInteger(totalUnits)) {
        return null;
    }

    const firstRawUnits = (totalUnits * firstWeight) / totalWeight;
    const secondRawUnits = (totalUnits * secondWeight) / totalWeight;
    const firstFloor = Math.floor(firstRawUnits);
    const secondFloor = Math.floor(secondRawUnits);
    const leftover = totalUnits - firstFloor - secondFloor;
    const firstUnits =
        firstFloor +
        (leftover > 0 && firstRawUnits - firstFloor >= secondRawUnits - secondFloor
            ? 1
            : 0);

    return payerId === first.id ? totalUnits - firstUnits : firstUnits;
};

const getSubmitState = (state: ExpenseModalStore) => {
    const split = getSplit(state);
    const payerId = getPayerId(
        state,
        state.targetMode === 'friends' ? split.includedUsers : split.users,
    );
    const hasNoDebt = getDirectNonPayerUnits(state, split, payerId) === 0;
    const isDirectValid = isDirectExpenseValid(state, split, payerId);
    const isDisabled =
        hasNoDebt ||
        split.totalAmount <= 0 ||
        !payerId ||
        (state.targetMode === 'group' && !state.groupId) ||
        (state.targetMode === 'group' &&
            split.users.length < MIN_GROUP_EXPENSE_PARTICIPANTS) ||
        !isDirectValid ||
        split.includedUsers.length === 0 ||
        !split.isValid;

    return { isDisabled, hasNoDebt, isDirectValid, payerId, split };
};

export const selectShouldShowSelfOnlyCallout = (state: ExpenseModalStore): boolean => {
    const { hasNoDebt, payerId } = getSubmitState(state);
    return hasNoDebt && payerId === state.source.currentUser?.id;
};

export const selectShouldShowOtherDirectZeroDebtWarning = (state: ExpenseModalStore): boolean => {
    const { hasNoDebt, payerId } = getSubmitState(state);
    return hasNoDebt && payerId !== state.source.currentUser?.id;
};

export const selectIsSubmitDisabled = (state: ExpenseModalStore) => {
    const { isDisabled } = getSubmitState(state);

    if (isDisabled) {
        return true;
    }

    if (state.mode !== 'edit' || !state.editContext) {
        return false;
    }

    const payload = selectExpensePayload(state);

    return payload === null || buildExpenseUpdateParams(
        state.editContext.original,
        payload,
    ) === null;
};

export const selectExpenseSubmitFeedback = (
    state: ExpenseModalStore,
): ExpenseSubmitFeedback | null => {
    const { split, payerId, hasNoDebt, isDirectValid } = getSubmitState(state);

    if (split.totalAmount <= 0) {
        return { reason: EXPENSE_SUBMIT_BLOCKERS.AMOUNT };
    }

    if (state.targetMode === 'group' && !state.groupId) {
        return { reason: EXPENSE_SUBMIT_BLOCKERS.TARGET };
    }

    if (
        (state.targetMode === 'group' && split.users.length < MIN_GROUP_EXPENSE_PARTICIPANTS) ||
        !isDirectValid ||
        split.includedUsers.length === 0
    ) {
        return { reason: EXPENSE_SUBMIT_BLOCKERS.PARTICIPANTS };
    }

    if (!payerId) {
        return { reason: EXPENSE_SUBMIT_BLOCKERS.PAYER };
    }

    if (!split.isValid) {
        if (state.splitMode === EXPENSE_SPLIT_MODES.PERCENT) {
            return {
                reason: split.totalPercent < 100
                    ? EXPENSE_SUBMIT_BLOCKERS.PERCENT_UNDER
                    : EXPENSE_SUBMIT_BLOCKERS.PERCENT_OVER,
                current: split.totalPercent,
                required: 100,
                difference: Math.abs(split.totalPercent - 100),
            };
        }

        if (state.splitMode === EXPENSE_SPLIT_MODES.AMOUNTS) {
            return {
                reason: split.totalCustomAmount < split.totalAmount
                    ? EXPENSE_SUBMIT_BLOCKERS.AMOUNTS_UNDER
                    : EXPENSE_SUBMIT_BLOCKERS.AMOUNTS_OVER,
                current: split.totalCustomAmount,
                required: split.totalAmount,
                difference: Math.abs(split.totalCustomAmount - split.totalAmount),
            };
        }

        return { reason: EXPENSE_SUBMIT_BLOCKERS.SHARES, current: split.totalShares };
    }

    if (hasNoDebt) {
        return { reason: EXPENSE_SUBMIT_BLOCKERS.NO_DEBT };
    }

    return selectIsSubmitDisabled(state)
        ? { reason: EXPENSE_SUBMIT_BLOCKERS.UNCHANGED }
        : null;
};

const getPayloadParticipants = (
    state: ExpenseModalStore,
    users: ExpenseParticipant[],
): { participantIds: string[]; sharingMode: SharingMode } => {
    const participantIds: string[] = [];
    const values: Record<string, number> = {};
    let sourceValues: Record<string, string> | undefined;

    switch (state.splitMode) {
        case EXPENSE_SPLIT_MODES.PERCENT:
            sourceValues = state.percentShares;
            break;
        case EXPENSE_SPLIT_MODES.AMOUNTS:
            sourceValues = state.amountShares;
            break;
        case EXPENSE_SPLIT_MODES.SHARES:
            sourceValues = state.shareWeights;
            break;
    }

    for (const user of users) {
        participantIds.push(user.id);

        if (sourceValues) {
            values[user.id] = Number(sourceValues[user.id] ?? 0);
        }
    }

    switch (state.splitMode) {
        case EXPENSE_SPLIT_MODES.PERCENT:
            return {
                participantIds,
                sharingMode: { type: 'PERCENTAGE', percentageShares: values },
            };
        case EXPENSE_SPLIT_MODES.AMOUNTS:
            return { participantIds, sharingMode: { type: 'EXACT', customShares: values } };
        case EXPENSE_SPLIT_MODES.SHARES:
            return { participantIds, sharingMode: { type: 'SHARES', shares: values } };
        case EXPENSE_SPLIT_MODES.EQUAL:
            return { participantIds, sharingMode: { type: 'AUTO' } };
    }
};

export const selectExpensePayload = (
    state: ExpenseModalStore,
    date = state.date,
): CreateLedgerEntryParams | null => {
    const { isDisabled, payerId, split } = getSubmitState(state);

    if (isDisabled) {
        return null;
    }

    const { participantIds, sharingMode } = getPayloadParticipants(state, split.includedUsers);

    return {
        ...(state.targetMode === 'group' ? { groupId: state.groupId } : {}),
        description: state.description,
        amount: getTotalAmount(state),
        date,
        payerId,
        participantIds,
        currency: state.currency,
        category: state.category || null,
        sharingMode,
    };
};

export const selectSplitSummary = (state: ExpenseModalStore) => {
    const split = getSplit(state);

    return {
        assignedAmount: split.assignedAmount,
        totalAmount: split.totalAmount,
        status: split.status,
        progressPercent: split.progressPercent,
        yourShareAmount: split.yourShareAmount,
    };
};
