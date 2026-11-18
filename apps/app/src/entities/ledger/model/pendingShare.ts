// The amount and "your share" of a queued expense (spec 03 §3, D20), for `OutboxSheet`: the
// user's part of a create the server has not answered yet. AUTO, SHARES and PERCENTAGE go through
// `split` (the backend `distributeAmount`, bit for bit); EXACT is the amount the form wrote. No
// balance is recomputed from it: it is shown only on the op's row.
import { currencyCode, type Money, moneyFromWire, split } from 'shared/money';

import type { ExpenseDraftWire } from './toExpenseWire';

/** The amount of the queued expense `draft`; null when it cannot be read (no amount is shown). */
export const pendingExpenseAmount = (draft: ExpenseDraftWire): Money | null => {
    try {
        return moneyFromWire(draft.amount, currencyCode(draft.currency));
    } catch {
        // Unreadable (moneyFromWire reports it): the row shows no amount.
        return null;
    }
};

const weightOf = (
    mode: NonNullable<ExpenseDraftWire['sharingMode']>,
    userId: string,
): string | undefined => {
    switch (mode.type) {
        case 'SHARES':
            return mode.shares[userId];
        case 'PERCENTAGE':
            return mode.percentageShares[userId];
        default:
            return '1';
    }
};

/**
 * The share of `userId` in the queued expense `draft`; null when the user is not a participant or
 * the draft cannot be read (the row then shows no share).
 */
export const pendingExpenseShare = (draft: ExpenseDraftWire, userId: string): Money | null => {
    if (!draft.participantIds.includes(userId)) {
        return null;
    }
    try {
        const total = moneyFromWire(draft.amount, currencyCode(draft.currency));
        const mode = draft.sharingMode ?? { type: 'AUTO' };

        if (mode.type === 'EXACT') {
            const exact = mode.customShares[userId];

            return exact === undefined ? null : moneyFromWire(exact, total.currency);
        }
        const shares = split(
            total,
            draft.participantIds.map(id => ({ userId: id, weight: weightOf(mode, id) ?? '0' })),
        );

        return shares[draft.participantIds.indexOf(userId)] ?? null;
    } catch {
        // An unreadable amount or weight (moneyFromWire reports it): no share is shown.
        return null;
    }
};
