import type {
    CreateLedgerEntryParams,
    SharingMode,
    UpdateLedgerExpenseParams,
} from 'api/chipin.types';

export interface ExpenseModalOriginalState {
    description: string | null;
    amount: number;
    date: number;
    payerId: string;
    participantIds: string[];
    currency: string;
    category: string | null;
    subcategory: string | null;
    sharingMode: SharingMode;
}

const normalizeDescription = (description: string | null): string | null =>
    description === '' || description === null ? null : description;

const normalizeCategory = (category: string | null): string | null => category || null;

const getSharingModeValues = (sharingMode: SharingMode): Record<string, number> | undefined => {
    switch (sharingMode.type) {
        case 'PERCENTAGE':
            return sharingMode.percentageShares;
        case 'EXACT':
            return sharingMode.customShares;
        case 'SHARES':
            return sharingMode.shares;
        case 'AUTO':
            return undefined;
    }
};

const areNumberMapsEqual = (
    left: Record<string, number> | undefined,
    right: Record<string, number> | undefined,
): boolean => {
    const keys = new Set<string>();

    if (left) {
        for (const key in left) {
            if (Object.prototype.hasOwnProperty.call(left, key)) {
                keys.add(key);
            }
        }
    }

    if (right) {
        for (const key in right) {
            if (Object.prototype.hasOwnProperty.call(right, key)) {
                keys.add(key);
            }
        }
    }

    for (const key of keys) {
        if ((left?.[key] ?? 0) !== (right?.[key] ?? 0)) {
            return false;
        }
    }

    return true;
};

const areSharingModesEqual = (left: SharingMode, right: SharingMode): boolean =>
    left.type === right.type && areNumberMapsEqual(
        getSharingModeValues(left),
        getSharingModeValues(right),
    );

const areParticipantIdsEqual = (left: string[], right: string[]): boolean => {
    if (left.length !== right.length) {
        return false;
    }

    const rightIds = new Set(right);

    for (const participantId of left) {
        if (!rightIds.has(participantId)) {
            return false;
        }
    }

    return true;
};

const hasSplitChanged = (
    original: ExpenseModalOriginalState,
    draft: CreateLedgerEntryParams,
): boolean =>
    original.amount !== draft.amount ||
    !areParticipantIdsEqual(original.participantIds, draft.participantIds) ||
    !areSharingModesEqual(original.sharingMode, draft.sharingMode ?? { type: 'AUTO' });

export const buildExpenseUpdateParams = (
    original: ExpenseModalOriginalState,
    draft: CreateLedgerEntryParams,
): UpdateLedgerExpenseParams | null => {
    const expense: UpdateLedgerExpenseParams['expense'] = {};
    let hasChanges = false;

    if (normalizeDescription(draft.description) !== original.description) {
        expense.description = normalizeDescription(draft.description);
        hasChanges = true;
    }

    if (draft.currency !== original.currency) {
        expense.currency = draft.currency;
        hasChanges = true;
    }

    if (draft.payerId !== original.payerId) {
        expense.payerId = draft.payerId;
        hasChanges = true;
    }

    if (draft.date !== original.date) {
        expense.date = draft.date;
        hasChanges = true;
    }

    if (normalizeCategory(draft.category ?? null) !== original.category) {
        expense.category = normalizeCategory(draft.category ?? null);
        hasChanges = true;
    }

    if (hasSplitChanged(original, draft)) {
        expense.amount = draft.amount;
        expense.participantIds = draft.participantIds;
        expense.sharingMode = draft.sharingMode ?? { type: 'AUTO' };
        hasChanges = true;
    }

    return hasChanges ? { type: 'EXPENSE', expense } : null;
};
