import type { User } from 'api/chipin.types';
import type { ExpenseSplitMode } from 'constants/chipin';

import type { ExpenseModalOriginalState } from './expenseModalUpdate';

export type ExpenseTargetMode = 'group' | 'friends';
export type ExpenseModalMode = 'create' | 'edit';
export type ExpenseParticipant = Pick<User, 'id' | 'displayName' | 'picture'>;

/** A known user the viewer can add a direct expense with. */
export interface ExpenseModalFriend extends ExpenseParticipant {
    /** The viewer's last selected currency with this known user (EXP-072); absent until set. */
    lastSelectedCurrency?: string | null;
}

export type ExpenseModalContext = 'dashboard' | 'friends' | 'group';

export interface ExpenseModalGroup {
    id: string;
    name?: string;
    members: ExpenseParticipant[];
    /** The viewer's last selected currency in this group (EXP-072); absent until set. */
    lastSelectedCurrency?: string | null;
}

export interface ExpenseModalSource {
    context: ExpenseModalContext;
    currentUser: ExpenseParticipant | null;
    /** The default (base) currency of the viewer's settings; null while unknown. */
    defaultCurrency: string | null;
    /** The viewer's last selected currency overall (EXP-072); absent until set or loaded. */
    lastSelectedCurrency?: string | null;
    defaultCategory: string;
    skipCategory: boolean;
    groups: ExpenseModalGroup[];
    knownFriends: ExpenseModalFriend[];
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
    /**
     * The user picked the currency in this editor (or it is an edit's stored currency): refreshed
     * or late data and a target change no longer replace it (EXP-073).
     */
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
    /**
     * Spec 03 §2.7: the client entry id of a create, made when the form opens (a repeated submit
     * carries it; only the outbox path sends it). Null in edit mode or without `crypto.randomUUID`.
     */
    clientEntryId: string | null;
    /** The user the draft belongs to (spec 03 §1.5): another user's sign-in resets it. */
    ownerId: string | null;
}

/**
 * The draft of an open modal as saved before an app reload and restored at startup (spec 04 §2.11
 * item 4, 04-2d). A create draft has no `source`: the modal rebuilds it from the live data.
 */
export type ExpenseModalDraft = Omit<ExpenseModalState, 'isOpened' | 'source'> & {
    source: ExpenseModalSource | null;
};

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
    /**
     * An open create modal takes the groups of a newer source (the list loaded after it opened)
     * and, while its target is a group not chosen yet, picks the default group.
     */
    applyLateGroups: (source: ExpenseModalSource) => void;
    /**
     * KB EXP-067: an open create modal takes the known friends of a newer source. A direct target
     * without a known selected friend picks the default friend; other draft values are kept.
     */
    applyLateKnownFriends: (source: ExpenseModalSource) => void;
    initializeEdit: (initialization: ExpenseModalEditInitialization) => void;
    reset: () => void;
    /**
     * Reopens the modal with a draft saved before an app reload. A create draft is kept by the next
     * `initialize`, which only takes the live source (the opened modal initializes on mount).
     */
    restoreDraft: (draft: ExpenseModalDraft) => void;
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
