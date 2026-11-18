// Spec 03 §2.6 (03-16b): the edit form opened on a conflict draft says so and offers "Discard my
// changes"; with offline writes off (the overlay empty) the form is unchanged.
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { OutboxOverlay } from 'entities/ledger';
import { currencyCode, fromUnits } from 'shared/money';
import { useConflictDraftStore } from 'store/conflictDraftStore';
import type { ExpenseModalEditInitialization } from 'store/expenseModalStore';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { ConflictDraftNotice } from './ConflictDraftNotice';

import 'i18n/index';

const ledger = vi.hoisted(() => ({
    draftEntryIds: null as Set<string> | null,
    discard: vi.fn<(entryId: string) => Promise<boolean>>(),
}));

// The real overlay (flag off: the empty view, no subscription) unless a test sets the drafts.
vi.mock('entities/ledger', async importOriginal => {
    const actual = await importOriginal<typeof import('entities/ledger')>();

    return {
        ...actual,
        useOutboxOverlay: (): OutboxOverlay => {
            const overlay = actual.useOutboxOverlay();

            return ledger.draftEntryIds
                ? { ...overlay, conflictDraftEntryIds: ledger.draftEntryIds }
                : overlay;
        },
        discardConflictDraft: ledger.discard,
    };
});

const user = { id: 'user-1', displayName: 'You', picture: null };

const edit: ExpenseModalEditInitialization = {
    mode: 'edit',
    source: {
        context: 'friends',
        currentUser: user,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [],
    },
    targetMode: 'friends',
    groupId: '',
    selectedFriendId: '',
    description: 'Mine',
    amount: '20',
    currency: 'USD',
    category: 'food',
    paidById: user.id,
    splitMode: 'equal',
    percentShares: {},
    amountShares: {},
    shareWeights: {},
    includedParticipantIds: { [user.id]: true },
    isPercentManuallyEdited: false,
    editContext: {
        entryId: 'entry-1',
        parentActivityId: 'activity-1',
        original: {
            description: 'Dinner',
            amount: fromUnits(200_000n, currencyCode('USD')),
            payerId: user.id,
            participantIds: [user.id],
            currency: 'USD',
            category: 'food',
            subcategory: null,
            sharingMode: { type: 'AUTO' },
        },
    },
};

beforeEach(() => {
    ledger.draftEntryIds = null;
    ledger.discard.mockResolvedValue(true);
    useExpenseModalStore.getState().initializeEdit(edit);
    useConflictDraftStore.getState().setOpened('entry-1');
});

afterEach(() => {
    act(() => {
        useExpenseModalStore.getState().reset();
        useConflictDraftStore.getState().reset();
    });
});

describe('03-16b the form opened on a conflict draft', () => {
    test('flag off = master: nothing is rendered', () => {
        const { container } = render(<ConflictDraftNotice />);

        expect(container.innerHTML).toBe('');
    });

    test('marks "your unsaved changes"; "Discard my changes" removes the draft (no request) and closes the form', async () => {
        ledger.draftEntryIds = new Set(['entry-1']);
        render(<ConflictDraftNotice />);

        expect(screen.getByText(/Your unsaved changes are shown/)).toBeTruthy();
        await userEvent.setup().click(screen.getByRole('button', { name: 'Discard my changes' }));

        expect(ledger.discard).toHaveBeenCalledWith('entry-1');
        await waitFor(() => {
            expect(useExpenseModalStore.getState().isOpened).toBe(false);
        });
        expect(useConflictDraftStore.getState().openedEntryId).toBeNull();
    });

    test('a form not opened on the draft, or an entry without one, has no marker', () => {
        ledger.draftEntryIds = new Set(['entry-2']);
        const { container } = render(<ConflictDraftNotice />);

        expect(container.innerHTML).toBe('');
        act(() => {
            ledger.draftEntryIds = new Set(['entry-1']);
            useConflictDraftStore.getState().setOpened(null);
        });
        expect(container.innerHTML).toBe('');
    });
});
