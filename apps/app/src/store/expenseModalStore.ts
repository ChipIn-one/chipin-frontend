import { create } from 'zustand';

import { DEFAULT_EXPENSE_CATEGORY } from 'constants/category';
import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
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
    type ExpenseModalCurrencyTarget,
    resolveExpenseModalCurrency,
} from './expenseModalCurrency';
import {
    selectAllUsersSelected,
    selectAmountShare,
    selectIncludedUsers,
    selectInputFractionDigits,
    selectUsers,
} from './expenseModalSelectors';
import type {
    ExpenseModalDraft,
    ExpenseModalSource,
    ExpenseModalState,
    ExpenseModalStore,
    ExpenseParticipant,
    ExpenseTargetMode,
} from './expenseModalTypes';

export type {
    ExpenseModalCurrencyTarget,
    InputCurrencyCandidates,
    InputCurrencyResolution,
    InputCurrencySource,
} from './expenseModalCurrency';
export { resolveExpenseModalCurrency, resolveInputCurrency } from './expenseModalCurrency';
export type {
    ExpenseModalContext,
    ExpenseModalDraft,
    ExpenseModalEditContext,
    ExpenseModalEditInitialization,
    ExpenseModalFriend,
    ExpenseModalGroup,
    ExpenseModalMode,
    ExpenseModalOpenOptions,
    ExpenseModalSource,
    ExpenseModalState,
    ExpenseModalStore,
    ExpenseParticipant,
    ExpenseTargetMode,
} from './expenseModalTypes';

const EMPTY_SOURCE: ExpenseModalSource = {
    context: 'dashboard',
    currentUser: null,
    defaultCurrency: null,
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
    clientEntryId: null,
    ownerId: null,
};

// `crypto.randomUUID` needs a secure context and a recent browser; without it there is no id (the
// online path never sends one).
const newClientEntryId = (): string | null =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : null;

const getDefaultFriendId = (source: ExpenseModalSource) => {
    if (
        source.preferredFriendId &&
        source.knownFriends.some(friend => friend.id === source.preferredFriendId)
    ) {
        return source.preferredFriendId;
    }

    return source.knownFriends[0]?.id ?? '';
};

// EXP-073: the automatic currency of a new expense follows its target; a picked one stays.
const getAutomaticCurrency = (
    state: Pick<ExpenseModalState, 'currency' | 'isCurrencyManuallyEdited'>,
    source: ExpenseModalSource,
    target: ExpenseModalCurrencyTarget,
): string =>
    // A direct target without a friend (deselected) keeps the automatic currency it had.
    state.isCurrencyManuallyEdited || (target.targetMode === 'friends' && !target.selectedFriendId)
        ? state.currency
        : resolveExpenseModalCurrency(source, target).currency;

const samePreference = (a?: string | null, b?: string | null): boolean =>
    (a ?? null) === (b ?? null);

/**
 * The stored source with the preferences of the live one (EXP-073): the default currency, the
 * overall last selected currency, and that of each stored group and friend the live source has.
 * The stored source itself when nothing changed.
 */
const refreshPreferences = (
    stored: ExpenseModalSource,
    live: ExpenseModalSource,
): ExpenseModalSource => {
    const liveGroups = new Map(live.groups.map(group => [group.id, group]));
    const liveFriends = new Map(live.knownFriends.map(friend => [friend.id, friend]));
    let isChanged =
        stored.defaultCurrency !== live.defaultCurrency ||
        !samePreference(stored.lastSelectedCurrency, live.lastSelectedCurrency);
    const refresh = <Item extends { lastSelectedCurrency?: string | null }>(
        item: Item,
        liveItem: Item | undefined,
    ): Item => {
        if (!liveItem || samePreference(item.lastSelectedCurrency, liveItem.lastSelectedCurrency)) {
            return item;
        }
        isChanged = true;
        return { ...item, lastSelectedCurrency: liveItem.lastSelectedCurrency ?? null };
    };
    const groups = stored.groups.map(group => refresh(group, liveGroups.get(group.id)));
    const knownFriends = stored.knownFriends.map(friend =>
        refresh(friend, liveFriends.get(friend.id)),
    );

    return isChanged
        ? {
              ...stored,
              defaultCurrency: live.defaultCurrency,
              lastSelectedCurrency: live.lastSelectedCurrency ?? null,
              groups,
              knownFriends,
          }
        : stored;
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

    // A group page uses only its own group: one missing from the list is waited for, never
    // replaced by another group.
    if (source.context === 'group') {
        return source.defaultGroupId ? (requestedGroup?.id ?? '') : (source.groups[0]?.id ?? '');
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
        clientEntryId: newClientEntryId(),
        ownerId: source.currentUser?.id ?? getLocalUser()?.id ?? null,
        targetMode,
        groupId,
        selectedFriendId,
        currency: resolveExpenseModalCurrency(source, { targetMode, groupId, selectedFriendId })
            .currency,
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

// Spec 04 §2.11 item 4 (04-2d): `app/pwa/expenseDraftReload.ts` saves the open draft to
// session storage before an app reload (an `onBeforeAppReload` callback; `editContext.original`
// holds `Money`, so it uses a bigint-safe codec) and restores it at startup through `restoreDraft`.
// A restored create draft waits here for the `initialize` of the modal that opens on mount.
let pendingCreateDraft: ExpenseModalDraft | null = null;

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
        const restored = pendingCreateDraft;

        pendingCreateDraft = null;
        set(state => ({
            ...state,
            ...getInitializedState(source),
            ...(restored ? { ...restored, source, isOpened: true } : {}),
        }));
    },
    applyLateGroups: source => {
        set(state => {
            if (!state.isOpened || state.mode !== 'create') {
                return state;
            }

            // Known users loaded after the modal opened (a restored draft opens before them): the
            // store takes the live list, as it does for groups.
            const storedFriendIds = new Set(state.source.knownFriends.map(friend => friend.id));
            const hasNewFriends = source.knownFriends.some(
                friend => !storedFriendIds.has(friend.id),
            );
            const withFriends: ExpenseModalSource = hasNewFriends
                ? { ...state.source, knownFriends: source.knownFriends }
                : state.source;
            // EXP-073: refreshed preferences (a reload after a create, a late self user or known
            // users) reach the stored source even when the groups are the same ones.
            const refreshed: ExpenseModalState = {
                ...state,
                source: refreshPreferences(withFriends, source),
            };
            const storedGroupIds = new Set(state.source.groups.map(group => group.id));
            const hasNewGroups = source.groups.some(group => !storedGroupIds.has(group.id));
            // A friend target or a chosen group is the user's (or the opening's) choice: kept.
            const needsGroup = state.targetMode === 'group' && !state.groupId;
            // The group select lists the live groups: the store keeps the same list, so a group
            // picked later has its members.
            const withGroups: ExpenseModalState =
                hasNewGroups || needsGroup
                    ? {
                          ...refreshed,
                          source: {
                              ...refreshed.source,
                              groups: hasNewGroups ? source.groups : refreshed.source.groups,
                              // A modal opened on a group page keeps that page's group, even after
                              // a navigation away changed the source.
                              defaultGroupId:
                                  state.source.context === 'group'
                                      ? state.source.defaultGroupId
                                      : source.defaultGroupId,
                          },
                      }
                    : refreshed;
            const groupId = needsGroup ? getDefaultGroupId(withGroups.source) : '';

            // Nothing refreshed and no group or target to change: the draft stays as it is.
            if (!hasNewGroups && !groupId && refreshed.source === state.source) {
                return state;
            }

            // Nothing new to pick from: only the refreshed preferences are kept.
            const withTarget: ExpenseModalState = groupId
                ? { ...withGroups, groupId }
                : hasNewGroups
                  ? withGroups
                  : refreshed;
            const next: ExpenseModalState = {
                ...withTarget,
                // An untouched currency follows the newest data for the current target; a picked
                // one stays.
                currency: getAutomaticCurrency(state, withTarget.source, withTarget),
            };

            return groupId ? { ...next, ...getSplitDefaults(next) } : next;
        });
    },
    initializeEdit: initialization => {
        set(state => ({
            ...state,
            ...initialization,
            clientEntryId: null,
            ownerId: initialization.source.currentUser?.id ?? getLocalUser()?.id ?? null,
            isOpened: true,
            isCurrencyManuallyEdited: true,
            openingContext: undefined,
            openingFriendId: undefined,
        }));
    },
    reset: () => {
        pendingCreateDraft = null;
        set(state => ({
            ...state,
            ...INITIAL_EXPENSE_MODAL_STATE,
        }));
    },
    restoreDraft: draft => {
        pendingCreateDraft = draft.mode === 'create' ? draft : null;
        set(state => ({
            ...state,
            ...INITIAL_EXPENSE_MODAL_STATE,
            ...draft,
            source: draft.source ?? EMPTY_SOURCE,
            isOpened: true,
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
                currency: getAutomaticCurrency(state, state.source, {
                    targetMode,
                    groupId: state.groupId,
                    selectedFriendId,
                }),
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
            currency: getAutomaticCurrency(state, state.source, {
                targetMode: 'group',
                groupId,
                selectedFriendId: state.selectedFriendId,
            }),
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
                    currency: getAutomaticCurrency(state, state.source, {
                        targetMode: 'friends',
                        groupId: state.groupId,
                        selectedFriendId,
                    }),
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
            const current = draft.amountShares[participantId];
            const parsedValue = parseAmountInput(
                value,
                selectInputFractionDigits(draft, current),
                current,
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

        let currentValue: number;

        // Not money: the stepper reads the percent/weight text (display input, not the
        // write path; spec 03 §4.3, the 03-14b deviation).
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
