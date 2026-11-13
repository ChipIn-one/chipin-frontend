import { create } from 'zustand';

import type { User } from 'api/chipin.types';
import { DEFAULT_EXPENSE_CATEGORY } from 'constants/category';
import { EXPENSE_SPLIT_MODES, type ExpenseSplitMode } from 'constants/chipin';
import { getLocalUser } from 'helpers/localStorage';
import { parseAmountInput } from 'helpers/numbers';
import { getUnixTimestampInSec } from 'helpers/time';
import {
    add,
    fromUnits,
    LEDGER_SCALE,
    minorUnits,
    type Money,
    roundToMinor,
    sign,
    toUnits,
} from 'shared/money';

import {
    selectAllUsersSelected,
    selectAmountShare,
    selectIncludedUsers,
    selectInputFractionDigits,
    selectUsers,
} from './expenseModalSelectors';
import type { ExpenseModalOriginalState } from './expenseModalUpdate';

export type ExpenseTargetMode = 'group' | 'friends';
export type ExpenseModalMode = 'create' | 'edit';
export type ExpenseParticipant = Pick<User, 'id' | 'displayName' | 'picture'>;

export type ExpenseModalContext = 'dashboard' | 'friends' | 'group';

export interface ExpenseModalGroup {
    id: string;
    name?: string;
    members: ExpenseParticipant[];
    lastUsedCurrency?: string | null;
}

export interface ExpenseModalSource {
    context: ExpenseModalContext;
    currentUser: ExpenseParticipant | null;
    defaultCurrency: string;
    defaultCategory: string;
    skipCategory: boolean;
    groups: ExpenseModalGroup[];
    knownFriends: ExpenseParticipant[];
    defaultGroupId?: string;
    preferredFriendId?: string;
}

export interface ExpenseModalOpenOptions {
    context?: 'friends';
    friendId?: string;
}

export interface ExpenseModalEditContext {
    entryId: string;
    groupId?: string;
    groupName?: string | null;
    parentActivityId?: string;
    original: ExpenseModalOriginalState;
}

export interface ExpenseModalState {
    isOpened: boolean;
    mode: ExpenseModalMode;
    openingContext?: 'friends';
    openingFriendId?: string;
    source: ExpenseModalSource;
    targetMode: ExpenseTargetMode;
    groupId: string;
    selectedFriendId: string;
    description: string;
    amount: string;
    date: number;
    currency: string;
    isCurrencyManuallyEdited: boolean;
    category: string;
    paidById: string;
    splitMode: ExpenseSplitMode;
    percentShares: Record<string, string>;
    amountShares: Record<string, string>;
    shareWeights: Record<string, string>;
    includedParticipantIds: Record<string, boolean>;
    isPercentManuallyEdited: boolean;
    editContext: ExpenseModalEditContext | null;
    /** The user the draft belongs to (spec 03 §1.5): another user's sign-in resets it. */
    ownerId: string | null;
}

export interface ExpenseModalEditInitialization {
    mode: 'edit';
    source: ExpenseModalSource;
    targetMode: ExpenseTargetMode;
    groupId: string;
    selectedFriendId: string;
    description: string;
    amount: string;
    currency: string;
    category: string;
    paidById: string;
    splitMode: ExpenseSplitMode;
    percentShares: Record<string, string>;
    amountShares: Record<string, string>;
    shareWeights: Record<string, string>;
    includedParticipantIds: Record<string, boolean>;
    isPercentManuallyEdited: boolean;
    editContext: ExpenseModalEditContext;
}

interface ExpenseModalActions {
    open: (options?: ExpenseModalOpenOptions) => void;
    close: () => void;
    setIsOpened: (isOpened: boolean) => void;
    initialize: (source: ExpenseModalSource) => void;
    initializeEdit: (initialization: ExpenseModalEditInitialization) => void;
    reset: () => void;
    setDescription: (description: string) => void;
    setAmount: (amount: string) => void;
    setDate: (date: number) => void;
    setCurrency: (currency: string) => void;
    setCategory: (category: string) => void;
    setPaidById: (paidById: string) => void;
    setTargetMode: (targetMode: ExpenseTargetMode) => void;
    setGroupId: (groupId: string) => void;
    setSplitMode: (splitMode: ExpenseSplitMode) => void;
    toggleAllParticipants: () => void;
    setParticipantIncluded: (participantId: string, isIncluded: boolean) => void;
    setSplitValue: (participantId: string, value: string) => void;
    stepSplitValue: (participantId: string, delta: number) => void;
}

export type ExpenseModalStore = ExpenseModalState & ExpenseModalActions;

const EMPTY_SOURCE: ExpenseModalSource = {
    context: 'dashboard',
    currentUser: null,
    defaultCurrency: '',
    defaultCategory: DEFAULT_EXPENSE_CATEGORY,
    skipCategory: false,
    groups: [],
    knownFriends: [],
};

const INITIAL_EXPENSE_MODAL_STATE: ExpenseModalState = {
    isOpened: false,
    mode: 'create',
    openingContext: undefined,
    openingFriendId: undefined,
    source: EMPTY_SOURCE,
    targetMode: 'group',
    groupId: '',
    selectedFriendId: '',
    description: '',
    amount: '',
    date: 0,
    currency: '',
    isCurrencyManuallyEdited: false,
    category: DEFAULT_EXPENSE_CATEGORY,
    paidById: '',
    splitMode: EXPENSE_SPLIT_MODES.EQUAL,
    percentShares: {},
    amountShares: {},
    shareWeights: {},
    includedParticipantIds: {},
    isPercentManuallyEdited: false,
    editContext: null,
    ownerId: null,
};

const getDefaultFriendId = (source: ExpenseModalSource) => {
    if (
        source.preferredFriendId &&
        source.knownFriends.some(friend => friend.id === source.preferredFriendId)
    ) {
        return source.preferredFriendId;
    }

    return source.knownFriends[0]?.id ?? '';
};

const getDefaultCurrency = (
    source: ExpenseModalSource,
    targetMode: ExpenseTargetMode,
    groupId: string,
) => {
    if (targetMode === 'friends') {
        return source.defaultCurrency;
    }

    return (
        source.groups.find(group => group.id === groupId)?.lastUsedCurrency ??
        source.defaultCurrency
    );
};

const createUserValues = <Value extends string | boolean>(
    users: ExpenseParticipant[],
    value: Value,
): Record<string, Value> => Object.fromEntries(users.map(user => [user.id, value]));

const createEqualPercentages = (users: ExpenseParticipant[]) => {
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

const getSplitDefaults = (state: ExpenseModalState) => {
    const members = selectUsers(state);
    const includedParticipantIds =
        state.targetMode === 'group'
            ? createUserValues(members, true)
            : Object.fromEntries(
                  members.map(member => [
                      member.id,
                      member.id === state.source.currentUser?.id ||
                          member.id === state.selectedFriendId,
                  ]),
              );
    const includedMembers = members.filter(member => includedParticipantIds[member.id]);
    const paidById =
        state.targetMode === 'friends'
            ? (state.source.currentUser?.id ?? members[0]?.id ?? '')
            : (members[0]?.id ?? '');

    return {
        paidById,
        percentShares: createEqualPercentages(includedMembers),
        amountShares: createUserValues(members, '0'),
        shareWeights: createUserValues(members, '1'),
        includedParticipantIds,
        isPercentManuallyEdited: false,
    };
};

const getPercentShares = (
    state: ExpenseModalState,
    includedParticipantIds = state.includedParticipantIds,
    splitMode = state.splitMode,
) => {
    if (splitMode !== EXPENSE_SPLIT_MODES.PERCENT || state.isPercentManuallyEdited) {
        return state.percentShares;
    }

    return createEqualPercentages(
        selectIncludedUsers({
            ...state,
            includedParticipantIds,
        }),
    );
};

const getDefaultGroupId = (source: ExpenseModalSource): string => {
    const requestedGroup = source.defaultGroupId
        ? source.groups.find(group => group.id === source.defaultGroupId)
        : undefined;

    if (source.context === 'group') {
        return requestedGroup?.id ?? source.groups[0]?.id ?? '';
    }

    const usableGroup =
        (requestedGroup && requestedGroup.members.length >= 2 ? requestedGroup : undefined) ??
        source.groups.find(group => group.members.length >= 2);

    return usableGroup?.id ?? requestedGroup?.id ?? source.groups[0]?.id ?? '';
};

const getInitializedState = (source: ExpenseModalSource): ExpenseModalState => {
    const groupId = getDefaultGroupId(source);
    const targetMode: ExpenseTargetMode =
        source.context === 'friends' ||
        (source.context === 'dashboard' &&
            source.knownFriends.length > 0 &&
            !source.groups.some(group => group.members.length >= 2))
            ? 'friends'
            : 'group';
    const selectedFriendId = getDefaultFriendId(source);
    const state: ExpenseModalState = {
        ...INITIAL_EXPENSE_MODAL_STATE,
        isOpened: true,
        mode: 'create',
        openingContext: source.context === 'friends' ? 'friends' : undefined,
        openingFriendId: source.preferredFriendId,
        source,
        ownerId: source.currentUser?.id ?? getLocalUser()?.id ?? null,
        targetMode,
        groupId,
        selectedFriendId,
        currency: getDefaultCurrency(source, targetMode, groupId),
        category: source.skipCategory ? '' : source.defaultCategory,
        date: getUnixTimestampInSec(),
    };

    return {
        ...state,
        ...getSplitDefaults(state),
    };
};

const LEDGER_UNIT = 10n ** BigInt(LEDGER_SCALE);

/**
 * `amount + delta` whole currency units, not below zero, rounded to the currency minor units and
 * written as input text with exactly that many fraction digits ("2.25", "3", "1.250").
 */
const stepAmount = (amount: Money, delta: number): string => {
    const stepped = add(amount, fromUnits(BigInt(delta) * LEDGER_UNIT, amount.currency));
    const units = toUnits(
        roundToMinor(sign(stepped) < 0 ? fromUnits(0n, amount.currency) : stepped),
    );
    const digits = minorUnits(amount.currency);
    const fraction = (units % LEDGER_UNIT).toString().padStart(LEDGER_SCALE, '0').slice(0, digits);

    return digits > 0 ? `${units / LEDGER_UNIT}.${fraction}` : `${units / LEDGER_UNIT}`;
};

// TODO(04-2d): save the open draft to `sessionStorage` in an `onBeforeAppReload` callback of
// `ServiceWorkerManager` and restore it at startup (spec 04 §2.11 item 4).
export const useExpenseModalStore = create<ExpenseModalStore>((set, get) => ({
    ...INITIAL_EXPENSE_MODAL_STATE,
    open: options => {
        set(state => ({
            ...state,
            isOpened: true,
            mode: 'create',
            editContext: null,
            openingContext: options?.context,
            openingFriendId: options?.friendId,
        }));
    },
    close: () => {
        set(state => ({
            ...state,
            isOpened: false,
            openingContext: undefined,
            openingFriendId: undefined,
        }));
    },
    setIsOpened: isOpened => {
        if (isOpened) {
            set(state => ({ ...state, isOpened: true }));
            return;
        }

        get().close();
    },
    initialize: source => {
        set(state => ({
            ...state,
            ...getInitializedState(source),
        }));
    },
    initializeEdit: initialization => {
        set(state => ({
            ...state,
            ...initialization,
            ownerId: initialization.source.currentUser?.id ?? getLocalUser()?.id ?? null,
            isOpened: true,
            isCurrencyManuallyEdited: true,
            openingContext: undefined,
            openingFriendId: undefined,
        }));
    },
    reset: () => {
        set(state => ({
            ...state,
            ...INITIAL_EXPENSE_MODAL_STATE,
        }));
    },
    setDescription: description => {
        set(state => ({ ...state, description }));
    },
    setAmount: amount => {
        set(state => ({ ...state, amount }));
    },
    setDate: date => {
        set(state => ({ ...state, date }));
    },
    setCurrency: currency => {
        set(state => ({
            ...state,
            currency,
            isCurrencyManuallyEdited: true,
        }));
    },
    setCategory: category => {
        set(state => ({ ...state, category }));
    },
    setPaidById: paidById => {
        set(state => ({ ...state, paidById }));
    },
    setTargetMode: targetMode => {
        set(state => {
            const selectedFriendId = state.selectedFriendId || getDefaultFriendId(state.source);

            return {
                ...state,
                targetMode,
                selectedFriendId,
                currency: state.isCurrencyManuallyEdited
                    ? state.currency
                    : getDefaultCurrency(state.source, targetMode, state.groupId),
                ...getSplitDefaults({
                    ...state,
                    targetMode,
                    selectedFriendId,
                }),
            };
        });
    },
    setGroupId: groupId => {
        set(state => ({
            ...state,
            targetMode: 'group',
            groupId,
            currency: state.isCurrencyManuallyEdited
                ? state.currency
                : getDefaultCurrency(state.source, 'group', groupId),
            ...getSplitDefaults({
                ...state,
                targetMode: 'group',
                groupId,
            }),
        }));
    },
    setSplitMode: splitMode => {
        set(state => ({
            ...state,
            splitMode,
            percentShares: getPercentShares(state, state.includedParticipantIds, splitMode),
        }));
    },
    toggleAllParticipants: () => {
        set(state => {
            const members = selectUsers(state);
            const isAllSelected = selectAllUsersSelected(state);
            const includedParticipantIds = isAllSelected
                ? createUserValues(members, false)
                : createUserValues(members, true);

            return {
                ...state,
                includedParticipantIds,
                percentShares: getPercentShares(state, includedParticipantIds),
            };
        });
    },
    setParticipantIncluded: (participantId, isIncluded) => {
        set(state => {
            if (state.targetMode === 'friends') {
                if (
                    participantId === state.source.currentUser?.id ||
                    state.source.preferredFriendId
                ) {
                    return state;
                }

                const selectedFriendId = isIncluded ? participantId : '';
                const includedParticipantIds = Object.fromEntries(
                    selectUsers(state).map(member => [
                        member.id,
                        member.id === state.source.currentUser?.id ||
                            member.id === selectedFriendId,
                    ]),
                );
                return {
                    ...state,
                    selectedFriendId,
                    includedParticipantIds,
                    paidById: includedParticipantIds[state.paidById]
                        ? state.paidById
                        : (state.source.currentUser?.id ?? ''),
                    percentShares: getPercentShares(state, includedParticipantIds),
                };
            }

            const includedParticipantIds = {
                ...state.includedParticipantIds,
                [participantId]: isIncluded,
            };

            return {
                ...state,
                includedParticipantIds,
                shareWeights: isIncluded
                    ? {
                          ...state.shareWeights,
                          [participantId]: state.shareWeights[participantId] ?? '1',
                      }
                    : state.shareWeights,
                percentShares: getPercentShares(state, includedParticipantIds),
            };
        });
    },
    setSplitValue: (participantId, value) => {
        const splitMode = get().splitMode;

        if (splitMode === EXPENSE_SPLIT_MODES.PERCENT) {
            if (!/^\d{0,3}$/.test(value)) {
                return;
            }

            set(state => ({
                ...state,
                percentShares: {
                    ...state.percentShares,
                    [participantId]: value,
                },
                isPercentManuallyEdited: true,
            }));
            return;
        }

        if (splitMode === EXPENSE_SPLIT_MODES.AMOUNTS) {
            // Input is limited to the currency minor units (spec 03 §4.2 `parseMoneyInput`), or to
            // the digits the current text already has, so an edit-loaded value can be erased.
            const draft = get();
            const parsedValue = parseAmountInput(
                value,
                selectInputFractionDigits(draft, draft.amountShares[participantId]),
            );

            if (parsedValue === null) {
                return;
            }

            set(state => ({
                ...state,
                amountShares: {
                    ...state.amountShares,
                    [participantId]: parsedValue,
                },
            }));
            return;
        }

        if (splitMode === EXPENSE_SPLIT_MODES.SHARES && /^\d{0,4}$/.test(value)) {
            set(state => ({
                ...state,
                shareWeights: {
                    ...state.shareWeights,
                    [participantId]: value,
                },
            }));
        }
    },
    stepSplitValue: (participantId, delta) => {
        const state = get();

        if (state.splitMode === EXPENSE_SPLIT_MODES.AMOUNTS) {
            if (Number.isSafeInteger(delta)) {
                state.setSplitValue(
                    participantId,
                    stepAmount(selectAmountShare(state, participantId), delta),
                );
            }
            return;
        }

        let currentValue = 0;

        if (state.splitMode === EXPENSE_SPLIT_MODES.PERCENT) {
            currentValue = Number(state.percentShares[participantId]) || 0;
        } else if (state.splitMode === EXPENSE_SPLIT_MODES.SHARES) {
            currentValue = Number(state.shareWeights[participantId]) || 0;
        } else {
            return;
        }

        state.setSplitValue(participantId, String(Math.max(0, currentValue + delta)));
    },
}));
