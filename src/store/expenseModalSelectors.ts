import type { CreateLedgerEntryParams, SharingMode } from 'api/chipin.types';
import {
    EXPENSE_SPLIT_MODES,
    EXPENSE_SPLIT_STATUSES,
    EXPENSE_SUBMIT_BLOCKERS,
    type ExpenseSplitStatus,
    type ExpenseSubmitBlocker,
    MIN_GROUP_EXPENSE_PARTICIPANTS,
} from 'constants/chipin';
import {
    abs,
    compare,
    type CurrencyCode,
    currencyCode,
    fromUnits,
    isZero,
    LEDGER_SCALE,
    type Money,
    roundToMinor,
    sign,
    split as splitMoney,
    sub,
    toUnits,
} from 'shared/money';

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

// The share preview runs on `shared/money` (spec 03 §4.1, §4.4): ledger units of scale 4 and the
// backend's own `distributeAmount` (`split`), so each previewed share equals the `participantShares`
// the backend stores for the same request. Display numbers are `roundToMinor` of the exact shares.
// The backend takes amounts and share weights with at most 4 decimals ("must not have more than 4
// decimal places") and percentages with any (it only needs them to total exactly 100).
const MAX_PERCENT_SCALE = 30;
// Like the wire boundary (decimal(19,4)): at most 15 integer digits; non-negative.
const MAX_INTEGER_DIGITS = 15;
const DECIMAL_TEXT = /^(\d*)(?:\.(\d*))?$/;
const FALLBACK_CURRENCY = 'XXX';

const fractionDigits = (text: string | undefined): number =>
    DECIMAL_TEXT.exec((text ?? '').trim())?.[2]?.length ?? 0;

/** A non-negative decimal text as an integer at `scale` ("1.5", 4 → 15000n), or null. */
const parseScaled = (text: string | undefined, scale: number): bigint | null => {
    const match = DECIMAL_TEXT.exec((text ?? '').trim());
    const [, integer = '', fraction = ''] = match ?? [];

    if (
        !match ||
        integer + fraction === '' ||
        integer.length > MAX_INTEGER_DIGITS ||
        fraction.length > scale
    ) {
        return null;
    }

    return BigInt(`${integer || '0'}${fraction.padEnd(scale, '0')}`);
};

/** Unparseable or empty input counts as zero, as `Number(value) || 0` did. */
const scaledOrZero = (text: string | undefined, scale: number): bigint =>
    parseScaled(text, scale) ?? 0n;

/** An integer at `scale` as the decimal text `split` takes as a weight (3333n, 2 → "33.33"). */
const scaledToText = (value: bigint, scale: number): string => {
    const unit = 10n ** BigInt(scale);

    return scale === 0
        ? value.toString()
        : `${value / unit}.${(value % unit).toString().padStart(scale, '0')}`;
};

/** A plain number for counters and percentages in feedback (not money). */
const scaledToNumber = (value: bigint, scale: number = LEDGER_SCALE): number =>
    Number(value) / 10 ** scale;

const percentTotal = (scale: number): bigint => 100n * 10n ** BigInt(scale);

const absValue = (value: bigint): bigint => (value < 0n ? -value : value);

/**
 * A number for the legacy number-based `Amount`, following `formatMoney` (spec 03 §4.2, §4.5): the
 * amount rounded to the currency minor units; a non-zero amount that rounds to zero stays exact,
 * so `Amount` shows it as "< 0.01". Display only, until `Amount` takes `formatMoneyParts`.
 */
const toDisplayNumber = (money: Money): number => {
    const rounded = roundToMinor(money);

    return scaledToNumber(toUnits(isZero(rounded) ? money : rounded));
};

/** The expense currency; before one is chosen, 'XXX' (shares do not depend on it, only rounding). */
export const selectCurrencyCode = (state: ExpenseModalState): CurrencyCode => {
    try {
        return currencyCode(state.currency);
    } catch {
        return currencyCode(FALLBACK_CURRENCY);
    }
};

/** The EXACT-mode amount entered for `userId` (zero when empty or not a decimal). */
export const selectAmountShare = (state: ExpenseModalState, userId: string): Money =>
    fromUnits(scaledOrZero(state.amountShares[userId], LEDGER_SCALE), selectCurrencyCode(state));

const getTotalMoney = (state: ExpenseModalStore): Money =>
    fromUnits(scaledOrZero(state.amount, LEDGER_SCALE), selectCurrencyCode(state));

const getTotalAmount = (state: ExpenseModalStore) => scaledToNumber(toUnits(getTotalMoney(state)));

/** The per-user values of the split mode as integers at one `scale`, and their sum. */
interface SplitValues {
    readonly scale: number;
    readonly byUserId: ReadonlyMap<string, bigint>;
    readonly total: bigint;
}

const getSplitValues = (
    state: ExpenseModalStore,
    includedUsers: readonly ExpenseParticipant[],
): SplitValues => {
    let texts: Record<string, string> = {};
    let scale = LEDGER_SCALE;

    switch (state.splitMode) {
        case EXPENSE_SPLIT_MODES.PERCENT:
            texts = state.percentShares;
            scale = Math.min(
                MAX_PERCENT_SCALE,
                Math.max(0, ...includedUsers.map(user => fractionDigits(texts[user.id]))),
            );
            break;
        case EXPENSE_SPLIT_MODES.AMOUNTS:
            texts = state.amountShares;
            break;
        case EXPENSE_SPLIT_MODES.SHARES:
            texts = state.shareWeights;
            break;
        case EXPENSE_SPLIT_MODES.EQUAL:
            break;
    }

    const byUserId = new Map<string, bigint>();
    let total = 0n;

    for (const user of includedUsers) {
        const value = scaledOrZero(texts[user.id], scale);

        byUserId.set(user.id, value);
        total += value;
    }

    return { scale, byUserId, total };
};

/** `money × percent / 100`, floored to a ledger unit: a percentage split that is not 100 % in total. */
const percentOf = (money: Money, percent: bigint, scale: number): Money =>
    fromUnits((toUnits(money) * percent) / percentTotal(scale), money.currency);

/**
 * The share of every included user (backend `ShareCalculationStrategies.kt`): AUTO splits by
 * weights '1', SHARES by the weights, PERCENTAGE by the percentages (when they total exactly 100),
 * EXACT takes the entered amounts. An invalid split previews what it can: zero shares without a
 * positive weight, `total × p / 100` per user when the percentages do not total 100.
 */
const getShares = (
    state: ExpenseModalStore,
    total: Money,
    includedUsers: readonly ExpenseParticipant[],
    values: SplitValues,
): Map<string, Money> => {
    const zero = fromUnits(0n, total.currency);
    const valueOf = (userId: string) => values.byUserId.get(userId) ?? 0n;
    // `includedUsers` is the order of the payload's `participantIds`: the tie-break order.
    const byWeights = (weight: (userId: string) => string) => {
        const shares = splitMoney(
            total,
            includedUsers.map(user => ({ userId: user.id, weight: weight(user.id) })),
        );

        return new Map(includedUsers.map((user, index) => [user.id, shares[index] ?? zero]));
    };
    const byWeightValues = () => byWeights(userId => scaledToText(valueOf(userId), values.scale));

    if (includedUsers.length === 0) {
        return new Map();
    }

    switch (state.splitMode) {
        case EXPENSE_SPLIT_MODES.EQUAL:
            return byWeights(() => '1');
        case EXPENSE_SPLIT_MODES.SHARES:
            return values.total > 0n
                ? byWeightValues()
                : new Map(includedUsers.map(user => [user.id, zero]));
        case EXPENSE_SPLIT_MODES.PERCENT:
            return values.total === percentTotal(values.scale)
                ? byWeightValues()
                : new Map(
                      includedUsers.map(user => [
                          user.id,
                          percentOf(total, valueOf(user.id), values.scale),
                      ]),
                  );
        case EXPENSE_SPLIT_MODES.AMOUNTS:
            return new Map(
                includedUsers.map(user => [user.id, fromUnits(valueOf(user.id), total.currency)]),
            );
    }
};

const getSplitStatus = (assigned: Money, total: Money): ExpenseSplitStatus => {
    const difference = compare(assigned, total);

    if (difference === 0) {
        return EXPENSE_SPLIT_STATUSES.EXACT;
    }

    return difference < 0 ? EXPENSE_SPLIT_STATUSES.UNDER : EXPENSE_SPLIT_STATUSES.OVER;
};

const getAssigned = (
    state: ExpenseModalStore,
    total: Money,
    includedUserCount: number,
    values: SplitValues,
): Money => {
    const zero = fromUnits(0n, total.currency);

    if (includedUserCount === 0) {
        return zero;
    }

    switch (state.splitMode) {
        case EXPENSE_SPLIT_MODES.EQUAL:
            return total;
        case EXPENSE_SPLIT_MODES.SHARES:
            return values.total > 0n ? total : zero;
        case EXPENSE_SPLIT_MODES.PERCENT:
            return values.total === percentTotal(values.scale)
                ? total
                : percentOf(total, values.total, values.scale);
        case EXPENSE_SPLIT_MODES.AMOUNTS:
            return fromUnits(values.total, total.currency);
    }
};

const isSplitValid = (state: ExpenseModalStore, total: Money, values: SplitValues): boolean => {
    switch (state.splitMode) {
        case EXPENSE_SPLIT_MODES.EQUAL:
            return true;
        case EXPENSE_SPLIT_MODES.PERCENT:
            return values.total === percentTotal(values.scale);
        case EXPENSE_SPLIT_MODES.AMOUNTS:
            // The backend compares with `compareTo`: the sum must equal the amount exactly.
            return values.total === toUnits(total);
        case EXPENSE_SPLIT_MODES.SHARES:
            return values.total > 0n;
    }
};

const calculateSplit = (state: ExpenseModalStore) => {
    const users = selectUsers(state);
    const includedUsers: ExpenseParticipant[] = [];
    const total = getTotalMoney(state);
    const currentUserId = state.source.currentUser?.id;
    const includedUserIds = new Set<string>();
    const userIds: string[] = [];
    const usersById = new Map<string, ExpenseParticipant>();
    let directFriend: ExpenseParticipant | undefined;

    for (const user of users) {
        userIds.push(user.id);
        usersById.set(user.id, user);

        if (state.includedParticipantIds[user.id] === false) {
            continue;
        }

        includedUsers.push(user);
        includedUserIds.add(user.id);

        if (user.id !== currentUserId) {
            directFriend = user;
        }
    }

    const isDirectExpenseReady =
        state.targetMode !== 'friends' ||
        (includedUsers.length === 2 &&
            Boolean(currentUserId && includedUserIds.has(currentUserId)));
    const zero = fromUnits(0n, total.currency);
    const values = getSplitValues(state, includedUsers);
    const shares = getShares(state, total, includedUsers, values);
    const assigned = isDirectExpenseReady
        ? getAssigned(state, total, includedUsers.length, values)
        : zero;
    const yourShare =
        isDirectExpenseReady && currentUserId ? (shares.get(currentUserId) ?? zero) : zero;
    const totalAmount = scaledToNumber(toUnits(total));

    return {
        includedUsers,
        total,
        totalAmount,
        assigned,
        shares,
        yourShare,
        values,
        status: getSplitStatus(assigned, total),
        progressPercent:
            sign(total) > 0 ? (scaledToNumber(toUnits(assigned)) / totalAmount) * 100 : 0,
        isValid: isSplitValid(state, total, values),
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
    const share = split.shares.get(userId);

    return share ? toDisplayNumber(share) : 0;
};

/** One previewed share, in the order of the request body's `participantIds`. */
export interface PreviewShare {
    readonly userId: string;
    readonly share: Money;
}

/**
 * The exact share preview at ledger scale 4: what the backend will store as `participantShares`
 * for the payload this form submits (same participants, order, sharing mode and weights).
 */
export interface SharePreview {
    readonly total: Money;
    readonly assigned: Money;
    readonly yourShare: Money;
    readonly status: ExpenseSplitStatus;
    readonly isValid: boolean;
    readonly shares: readonly PreviewShare[];
}

export const selectSharePreview = (state: ExpenseModalStore): SharePreview => {
    const split = getSplit(state);
    const zero = fromUnits(0n, split.total.currency);

    return {
        total: split.total,
        assigned: split.assigned,
        yourShare: split.yourShare,
        status: split.status,
        isValid: split.isValid,
        shares: split.includedUsers.map(user => ({
            userId: user.id,
            share: split.shares.get(user.id) ?? zero,
        })),
    };
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

/** The previewed share of the non-payer of a valid direct expense (what they will owe), or null. */
const getDirectNonPayerShare = (
    state: ExpenseModalStore,
    split: ReturnType<typeof getSplit>,
    payerId: string,
): Money | null => {
    if (
        state.targetMode !== 'friends' ||
        sign(split.total) <= 0 ||
        !split.isValid ||
        !isDirectExpenseValid(state, split, payerId)
    ) {
        return null;
    }

    const [first, second] = split.includedUsers;

    if (!first || !second) {
        return null;
    }

    return split.shares.get(payerId === first.id ? second.id : first.id) ?? null;
};

const getSubmitState = (state: ExpenseModalStore) => {
    const split = getSplit(state);
    const payerId = getPayerId(
        state,
        state.targetMode === 'friends' ? split.includedUsers : split.users,
    );
    const nonPayerShare = getDirectNonPayerShare(state, split, payerId);
    const hasNoDebt = nonPayerShare !== null && isZero(nonPayerShare);
    const isDirectValid = isDirectExpenseValid(state, split, payerId);
    const isDisabled =
        hasNoDebt ||
        sign(split.total) <= 0 ||
        !payerId ||
        (state.targetMode === 'group' && !state.groupId) ||
        (state.targetMode === 'group' && split.users.length < MIN_GROUP_EXPENSE_PARTICIPANTS) ||
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

    return (
        payload === null || buildExpenseUpdateParams(state.editContext.original, payload) === null
    );
};

export const selectExpenseSubmitFeedback = (
    state: ExpenseModalStore,
): ExpenseSubmitFeedback | null => {
    const { split, payerId, hasNoDebt, isDirectValid } = getSubmitState(state);

    if (sign(split.total) <= 0) {
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
        const { scale, total } = split.values;

        if (state.splitMode === EXPENSE_SPLIT_MODES.PERCENT) {
            return {
                reason:
                    total < percentTotal(scale)
                        ? EXPENSE_SUBMIT_BLOCKERS.PERCENT_UNDER
                        : EXPENSE_SUBMIT_BLOCKERS.PERCENT_OVER,
                current: scaledToNumber(total, scale),
                required: 100,
                difference: scaledToNumber(absValue(total - percentTotal(scale)), scale),
            };
        }

        if (state.splitMode === EXPENSE_SPLIT_MODES.AMOUNTS) {
            const assigned = fromUnits(total, split.total.currency);

            return {
                reason:
                    compare(assigned, split.total) < 0
                        ? EXPENSE_SUBMIT_BLOCKERS.AMOUNTS_UNDER
                        : EXPENSE_SUBMIT_BLOCKERS.AMOUNTS_OVER,
                current: scaledToNumber(total),
                required: split.totalAmount,
                difference: scaledToNumber(toUnits(abs(sub(assigned, split.total)))),
            };
        }

        return { reason: EXPENSE_SUBMIT_BLOCKERS.SHARES, current: scaledToNumber(total) };
    }

    if (hasNoDebt) {
        return { reason: EXPENSE_SUBMIT_BLOCKERS.NO_DEBT };
    }

    return selectIsSubmitDisabled(state) ? { reason: EXPENSE_SUBMIT_BLOCKERS.UNCHANGED } : null;
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
        assignedAmount: toDisplayNumber(split.assigned),
        totalAmount: toDisplayNumber(split.total),
        status: split.status,
        progressPercent: split.progressPercent,
        yourShareAmount: toDisplayNumber(split.yourShare),
    };
};
