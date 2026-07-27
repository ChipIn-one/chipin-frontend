import { create } from 'zustand';

import type { User } from 'api/chipin.types';
import {
    EXPENSE_CATEGORIES,
    EXPENSE_SPLIT_MODES,
    type ExpenseCategory,
    type ExpenseSplitMode,
} from 'constants/chipin';
import { parseAmountInput } from 'helpers/numbers';

import {
    selectAllUsersSelected,
    selectIncludedUsers,
    selectUsers,
} from './expenseModalSelectors';

export type ExpenseTargetMode = 'group' | 'friends';
export type ExpenseParticipant = Pick<User, 'id' | 'displayName' | 'picture'>;

const DEFAULT_CATEGORY = Object.keys(EXPENSE_CATEGORIES)[0] as ExpenseCategory;

export type ExpenseModalContext = 'dashboard' | 'friends' | 'group';

export interface ExpenseModalGroup {
    id: string;
    members: ExpenseParticipant[];
}

export interface ExpenseModalSource {
    context: ExpenseModalContext;
    currentUser: ExpenseParticipant | null;
    defaultCurrency: string;
    groups: ExpenseModalGroup[];
    knownFriends: ExpenseParticipant[];
    defaultGroupId?: string;
    preferredFriendId?: string;
}

export interface ExpenseModalOpenOptions {
    context?: 'friends';
    friendId?: string;
}

export interface ExpenseModalState {
    isOpened: boolean;
    openingContext?: 'friends';
    openingFriendId?: string;
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
}

interface ExpenseModalActions {
    open: (options?: ExpenseModalOpenOptions) => void;
    close: () => void;
    setIsOpened: (isOpened: boolean) => void;
    initialize: (source: ExpenseModalSource) => void;
    reset: () => void;
    setDescription: (description: string) => void;
    setAmount: (amount: string) => void;
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
    groups: [],
    knownFriends: [],
};

const INITIAL_EXPENSE_MODAL_STATE: ExpenseModalState = {
    isOpened: false,
    openingContext: undefined,
    openingFriendId: undefined,
    source: EMPTY_SOURCE,
    targetMode: 'group',
    groupId: '',
    selectedFriendId: '',
    description: '',
    amount: '',
    currency: '',
    category: DEFAULT_CATEGORY,
    paidById: '',
    splitMode: EXPENSE_SPLIT_MODES.EQUAL,
    percentShares: {},
    amountShares: {},
    shareWeights: {},
    includedParticipantIds: {},
    isPercentManuallyEdited: false,
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const getDefaultFriendId = (source: ExpenseModalSource) => {
    if (
        source.preferredFriendId &&
        source.knownFriends.some(
            friend => friend.id === source.preferredFriendId,
        )
    ) {
        return source.preferredFriendId;
    }

    return source.knownFriends[0]?.id ?? '';
};

const createUserValues = <Value extends string | boolean>(
    users: ExpenseParticipant[],
    value: Value,
): Record<string, Value> =>
    Object.fromEntries(users.map(user => [user.id, value]));

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
    const includedMembers = members.filter(
        member => includedParticipantIds[member.id],
    );
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
    if (
        splitMode !== EXPENSE_SPLIT_MODES.PERCENT ||
        state.isPercentManuallyEdited
    ) {
        return state.percentShares;
    }

    return createEqualPercentages(
        selectIncludedUsers({
            ...state,
            includedParticipantIds,
        }),
    );
};

const getInitializedState = (
    source: ExpenseModalSource,
): ExpenseModalState => {
    const targetMode: ExpenseTargetMode =
        source.context === 'friends' ||
        (!source.groups.length && source.knownFriends.length > 0)
            ? 'friends'
            : 'group';
    const groupId = source.defaultGroupId ?? source.groups[0]?.id ?? '';
    const selectedFriendId = getDefaultFriendId(source);
    const state: ExpenseModalState = {
        ...INITIAL_EXPENSE_MODAL_STATE,
        isOpened: true,
        openingContext:
            source.context === 'friends' ? 'friends' : undefined,
        openingFriendId: source.preferredFriendId,
        source,
        targetMode,
        groupId,
        selectedFriendId,
        currency: source.defaultCurrency,
    };

    return {
        ...state,
        ...getSplitDefaults(state),
    };
};

export const useExpenseModalStore = create<ExpenseModalStore>((set, get) => ({
    ...INITIAL_EXPENSE_MODAL_STATE,
    open: options => {
        set(state => ({
            ...state,
            isOpened: true,
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
    setCurrency: currency => {
        set(state => ({ ...state, currency }));
    },
    setCategory: category => {
        set(state => ({ ...state, category }));
    },
    setPaidById: paidById => {
        set(state => ({ ...state, paidById }));
    },
    setTargetMode: targetMode => {
        set(state => {
            const selectedFriendId =
                state.selectedFriendId ||
                getDefaultFriendId(state.source);

            return {
                ...state,
                targetMode,
                selectedFriendId,
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
            percentShares: getPercentShares(
                state,
                state.includedParticipantIds,
                splitMode,
            ),
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
                percentShares: getPercentShares(
                    state,
                    includedParticipantIds,
                ),
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
                    percentShares: getPercentShares(
                        state,
                        includedParticipantIds,
                    ),
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
                          [participantId]:
                              state.shareWeights[participantId] ?? '1',
                      }
                    : state.shareWeights,
                percentShares: getPercentShares(
                    state,
                    includedParticipantIds,
                ),
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
            const parsedValue = parseAmountInput(value);

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

        if (
            splitMode === EXPENSE_SPLIT_MODES.SHARES &&
            /^\d{0,4}$/.test(value)
        ) {
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
        let currentValue = 0;

        if (state.splitMode === EXPENSE_SPLIT_MODES.PERCENT) {
            currentValue = Number(state.percentShares[participantId]) || 0;
        } else if (state.splitMode === EXPENSE_SPLIT_MODES.AMOUNTS) {
            currentValue = Number(state.amountShares[participantId]) || 0;
        } else if (state.splitMode === EXPENSE_SPLIT_MODES.SHARES) {
            currentValue = Number(state.shareWeights[participantId]) || 0;
        } else {
            return;
        }

        const nextValue = Math.max(0, currentValue + delta);
        const formattedValue =
            state.splitMode === EXPENSE_SPLIT_MODES.AMOUNTS
                ? roundMoney(nextValue).toFixed(2)
                : String(nextValue);

        state.setSplitValue(participantId, formattedValue);
    },
}));
