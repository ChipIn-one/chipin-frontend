import type { CreateLedgerEntryParams, SharingMode } from 'api/chipin.types';
import {
    EXPENSE_SPLIT_MODES,
    EXPENSE_SPLIT_STATUSES,
    type ExpenseSplitStatus,
} from 'constants/chipin';

import type {
    ExpenseModalState,
    ExpenseModalStore,
    ExpenseParticipant,
} from './expenseModalStore';

type ShareColor = 'gray' | 'jade' | 'red';

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const putCurrentUserFirst = (
    users: ExpenseParticipant[],
    currentUserId?: string,
) => {
    const currentUser = users.find(user => user.id === currentUserId);

    if (!currentUser) {
        return users;
    }

    return [
        currentUser,
        ...users.filter(user => user.id !== currentUserId),
    ];
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

    return [currentUser, selectedFriend].filter(
        (user): user is ExpenseParticipant => Boolean(user),
    );
};

export const selectUsers = (state: ExpenseModalState) => {
    const users =
        state.targetMode === 'friends'
            ? getDirectExpenseUsers(state)
            : (state.source.groups.find(group => group.id === state.groupId)
                  ?.members ?? []);

    return putCurrentUserFirst(users, state.source.currentUser?.id);
};

export const selectIncludedUsers = (state: ExpenseModalState) => {
    const users = selectUsers(state);

    return users.filter(
        user => state.includedParticipantIds[user.id] !== false,
    );
};

export const selectPayerUsers = (state: ExpenseModalStore) =>
    state.targetMode === 'friends'
        ? selectIncludedUsers(state)
        : selectUsers(state);

export const selectPayerId = (state: ExpenseModalStore) => {
    const users = selectPayerUsers(state);

    if (users.some(user => user.id === state.paidById)) {
        return state.paidById;
    }

    if (state.targetMode === 'friends' && state.source.currentUser) {
        return state.source.currentUser.id;
    }

    return users[0]?.id ?? '';
};

const getTotalAmount = (state: ExpenseModalStore) => {
    const amount = Number(state.amount);

    return Number.isFinite(amount) ? amount : 0;
};

const sumUserValues = (
    users: ExpenseParticipant[],
    values: Record<string, string>,
) =>
    users.reduce(
        (total, user) => total + (Number(values[user.id]) || 0),
        0,
    );

const getUserAmount = (
    state: ExpenseModalStore,
    userId: string,
    includedUsers: ExpenseParticipant[],
    totalAmount: number,
    totalShares: number,
) => {
    if (!includedUsers.some(user => user.id === userId)) {
        return 0;
    }

    switch (state.splitMode) {
        case EXPENSE_SPLIT_MODES.EQUAL:
            return roundMoney(totalAmount / includedUsers.length);
        case EXPENSE_SPLIT_MODES.PERCENT:
            return roundMoney(
                (totalAmount * (Number(state.percentShares[userId]) || 0)) /
                    100,
            );
        case EXPENSE_SPLIT_MODES.AMOUNTS:
            return roundMoney(Number(state.amountShares[userId]) || 0);
        case EXPENSE_SPLIT_MODES.SHARES:
            return totalShares > 0
                ? roundMoney(
                      (totalAmount *
                          (Number(state.shareWeights[userId]) || 0)) /
                          totalShares,
                  )
                : 0;
    }
};

const getSplitStatus = (
    assignedAmount: number,
    totalAmount: number,
): ExpenseSplitStatus => {
    if (assignedAmount === totalAmount) {
        return EXPENSE_SPLIT_STATUSES.EXACT;
    }

    return assignedAmount < totalAmount
        ? EXPENSE_SPLIT_STATUSES.UNDER
        : EXPENSE_SPLIT_STATUSES.OVER;
};

const getSplit = (state: ExpenseModalStore) => {
    const includedUsers = selectIncludedUsers(state);
    const totalAmount = getTotalAmount(state);
    const totalPercent = sumUserValues(includedUsers, state.percentShares);
    const totalCustomAmount = sumUserValues(
        includedUsers,
        state.amountShares,
    );
    const totalShares = sumUserValues(includedUsers, state.shareWeights);
    const currentUserId = state.source.currentUser?.id;
    const isDirectExpenseReady =
        state.targetMode !== 'friends' ||
        (includedUsers.length === 2 &&
            includedUsers.some(user => user.id === currentUserId));
    let assignedAmount = totalAmount;

    if (!isDirectExpenseReady) {
        assignedAmount = 0;
    } else if (state.splitMode === EXPENSE_SPLIT_MODES.EQUAL) {
        assignedAmount = includedUsers.length > 0 ? totalAmount : 0;
    } else if (state.splitMode === EXPENSE_SPLIT_MODES.PERCENT) {
        assignedAmount = roundMoney((totalAmount * totalPercent) / 100);
    } else if (state.splitMode === EXPENSE_SPLIT_MODES.AMOUNTS) {
        assignedAmount = roundMoney(totalCustomAmount);
    } else if (state.splitMode === EXPENSE_SPLIT_MODES.SHARES) {
        assignedAmount = totalShares > 0 ? totalAmount : 0;
    }

    return {
        includedUsers,
        totalAmount,
        assignedAmount,
        status: getSplitStatus(assignedAmount, totalAmount),
        progressPercent:
            totalAmount > 0 ? (assignedAmount / totalAmount) * 100 : 0,
        yourShareAmount:
            isDirectExpenseReady && currentUserId
                ? getUserAmount(
                      state,
                      currentUserId,
                      includedUsers,
                      totalAmount,
                      totalShares,
                  )
                : 0,
        isValid:
            (state.splitMode !== EXPENSE_SPLIT_MODES.PERCENT ||
                totalPercent === 100) &&
            (state.splitMode !== EXPENSE_SPLIT_MODES.AMOUNTS ||
                Math.abs(totalCustomAmount - totalAmount) < 0.001) &&
            (state.splitMode !== EXPENSE_SPLIT_MODES.SHARES ||
                totalShares > 0),
        totalShares,
    };
};

export const selectUserIds = (state: ExpenseModalStore) =>
    selectUsers(state).map(user => user.id);

export const selectAllUsersSelected = (state: ExpenseModalStore) => {
    const users = selectUsers(state);

    return (
        users.length > 0 &&
        users.every(user => state.includedParticipantIds[user.id] !== false)
    );
};

export const selectUserAmount = (
    state: ExpenseModalStore,
    userId: string,
) => {
    const split = getSplit(state);

    return getUserAmount(
        state,
        userId,
        split.includedUsers,
        split.totalAmount,
        split.totalShares,
    );
};

export const selectIsUserLocked = (
    state: ExpenseModalStore,
    userId: string,
) =>
    state.targetMode === 'friends' &&
    (Boolean(state.source.preferredFriendId) ||
        userId === state.source.currentUser?.id);

export const selectIsDirectExpense = (state: ExpenseModalStore) =>
    state.targetMode === 'friends' && selectUsers(state).length === 2;

export const selectAmountStep = (state: ExpenseModalStore) =>
    Math.max(1, Math.round(getTotalAmount(state) / 100));

export const selectYourShareColor = (
    state: ExpenseModalStore,
): ShareColor => {
    const currentUserId = state.source.currentUser?.id;
    const payerId = selectPayerId(state);

    if (!currentUserId || !payerId) {
        return 'gray';
    }

    return payerId === currentUserId ? 'jade' : 'red';
};

const isDirectExpenseValid = (
    state: ExpenseModalStore,
    users: ExpenseParticipant[],
    payerId: string,
) => {
    if (state.targetMode !== 'friends') {
        return true;
    }

    const currentUserId = state.source.currentUser?.id;
    const friend = users.find(user => user.id !== currentUserId);

    return (
        Boolean(currentUserId) &&
        users.length === 2 &&
        new Set(users.map(user => user.id)).size === 2 &&
        users.some(user => user.id === currentUserId) &&
        users.some(user => user.id === payerId) &&
        Boolean(
            friend &&
                state.source.knownFriends.some(
                    knownFriend => knownFriend.id === friend.id,
                ),
        )
    );
};

export const selectIsSubmitDisabled = (state: ExpenseModalStore) => {
    const split = getSplit(state);
    const payerId = selectPayerId(state);

    return (
        split.totalAmount <= 0 ||
        !payerId ||
        (state.targetMode === 'group' && !state.groupId) ||
        !isDirectExpenseValid(state, split.includedUsers, payerId) ||
        split.includedUsers.length === 0 ||
        !split.isValid
    );
};

const getSharingMode = (
    state: ExpenseModalStore,
    users: ExpenseParticipant[],
): SharingMode => {
    const getValues = (values: Record<string, string>) =>
        Object.fromEntries(
            users.map(user => [user.id, Number(values[user.id] ?? 0)]),
        );

    switch (state.splitMode) {
        case EXPENSE_SPLIT_MODES.PERCENT:
            return {
                type: 'PERCENTAGE',
                percentageShares: getValues(state.percentShares),
            };
        case EXPENSE_SPLIT_MODES.AMOUNTS:
            return {
                type: 'EXACT',
                customShares: getValues(state.amountShares),
            };
        case EXPENSE_SPLIT_MODES.SHARES:
            return {
                type: 'SHARES',
                shares: getValues(state.shareWeights),
            };
        case EXPENSE_SPLIT_MODES.EQUAL:
            return { type: 'AUTO' };
    }
};

export const selectExpensePayload = (
    state: ExpenseModalStore,
    date: number,
): CreateLedgerEntryParams | null => {
    if (selectIsSubmitDisabled(state)) {
        return null;
    }

    const users = selectIncludedUsers(state);

    return {
        ...(state.targetMode === 'group' ? { groupId: state.groupId } : {}),
        description: state.description,
        amount: getTotalAmount(state),
        date,
        payerId: selectPayerId(state),
        participantIds: users.map(user => user.id),
        currency: state.currency,
        category: state.category,
        sharingMode: getSharingMode(state, users),
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
