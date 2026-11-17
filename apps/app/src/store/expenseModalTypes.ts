import type { User } from 'api/chipin.types';
import type { ExpenseSplitMode } from 'constants/chipin';

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
    /**
     * An open create modal takes the groups of a newer source (the list loaded after it opened)
     * and, while its target is a group not chosen yet, picks the default group.
     */
    applyLateGroups: (source: ExpenseModalSource) => void;
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
