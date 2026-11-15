import type { ExpenseDraft, ExpenseDraftSharingMode, ExpensePatch } from 'entities/ledger';
import { canonicalDecimal } from 'entities/ledger';
import { type Money, toUnits } from 'shared/money';

/** The edited expense as it was: what an edit is compared with to find the changed fields. */
export interface ExpenseModalOriginalState {
    description: string | null;
    amount: Money;
    payerId: string;
    participantIds: readonly string[];
    currency: string;
    category: string | null;
    subcategory: string | null;
    sharingMode: ExpenseDraftSharingMode;
}

const normalizeDescription = (description: string | null): string | null =>
    description === '' || description === null ? null : description;

const normalizeCategory = (category: string | null): string | null => category || null;

const decimalValues = (values: Readonly<Record<string, string>>): Record<string, string> =>
    Object.fromEntries(
        Object.entries(values).map(([key, text]) => [key, canonicalDecimal(text) ?? text]),
    );

// A share value as comparable text: EXACT amounts by their ledger units, percents and weights by
// their shortest decimal text, so "50" and "50.0000" are the same value.
const getSharingModeValues = (
    sharingMode: ExpenseDraftSharingMode,
): Record<string, string> | undefined => {
    switch (sharingMode.type) {
        case 'PERCENTAGE':
            return decimalValues(sharingMode.percentageShares);
        case 'EXACT':
            return Object.fromEntries(
                Object.entries(sharingMode.customShares).map(([key, money]) => [
                    key,
                    toUnits(money).toString(),
                ]),
            );
        case 'SHARES':
            return decimalValues(sharingMode.shares);
        case 'AUTO':
            return undefined;
    }
};

// A missing value counts as zero, as it did when the values were numbers.
const ZERO = '0';

const areValueMapsEqual = (
    left: Record<string, string> | undefined,
    right: Record<string, string> | undefined,
): boolean => {
    const keys = new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})]);

    for (const key of keys) {
        if ((left?.[key] ?? ZERO) !== (right?.[key] ?? ZERO)) {
            return false;
        }
    }

    return true;
};

const areSharingModesEqual = (
    left: ExpenseDraftSharingMode,
    right: ExpenseDraftSharingMode,
): boolean =>
    left.type === right.type &&
    areValueMapsEqual(getSharingModeValues(left), getSharingModeValues(right));

const areParticipantIdsEqual = (left: readonly string[], right: readonly string[]): boolean => {
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

// The amount is compared by its ledger units: a currency change alone is the `currency` field.
const hasSplitChanged = (original: ExpenseModalOriginalState, draft: ExpenseDraft): boolean =>
    toUnits(original.amount) !== toUnits(draft.amount) ||
    !areParticipantIdsEqual(original.participantIds, draft.participantIds) ||
    !areSharingModesEqual(original.sharingMode, draft.sharingMode);

type MutablePatch = { -readonly [Key in keyof ExpensePatch]: ExpensePatch[Key] };

/**
 * The fields of `draft` that differ from `original`, or null when nothing changed. The date is not
 * one of them: the form has no date field, so an edit never changes it.
 */
export const buildExpenseUpdateParams = (
    original: ExpenseModalOriginalState,
    draft: ExpenseDraft,
): ExpensePatch | null => {
    const patch: MutablePatch = {};

    if (normalizeDescription(draft.description) !== original.description) {
        patch.description = normalizeDescription(draft.description);
    }

    if (draft.amount.currency !== original.currency) {
        patch.currency = draft.amount.currency;
    }

    if (draft.payerId !== original.payerId) {
        patch.payerId = draft.payerId;
    }

    if (normalizeCategory(draft.category) !== original.category) {
        patch.category = normalizeCategory(draft.category);
    }

    if (hasSplitChanged(original, draft)) {
        patch.amount = draft.amount;
        patch.participantIds = draft.participantIds;
        patch.sharingMode = draft.sharingMode;
    }

    return Object.keys(patch).length > 0 ? patch : null;
};
