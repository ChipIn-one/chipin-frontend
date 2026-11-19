import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    type FailedOutboxItem,
    type LedgerConflictNotice,
    ledgerKeys,
    type OutboxOverlay,
    type PendingOutboxItem,
} from 'entities/ledger';
import { currencyCode, fromUnits } from 'shared/money';
import { useConflictDraftStore } from 'store/conflictDraftStore';
import { useOutboxSheetStore } from 'store/outboxSheetStore';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';

import { OutboxControls } from './index';

import 'i18n/index';

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}));

const ledger = vi.hoisted(() => ({
    overlay: null as OutboxOverlay | null,
    discard: vi.fn<(client: unknown, item: unknown) => Promise<boolean>>(),
    retry: vi.fn<(item: unknown) => Promise<boolean>>(),
    discardDraft: vi.fn<(entryId: string) => Promise<boolean>>(),
    noticeListener: null as ((notice: LedgerConflictNotice) => void) | null,
}));

// The real overlay unless a test sets one (flag off: the real one is the empty view).
vi.mock('entities/ledger', async importOriginal => {
    const actual = await importOriginal<typeof import('entities/ledger')>();

    return {
        ...actual,
        useOutboxOverlay: () => ledger.overlay ?? actual.useOutboxOverlay(),
        discardOutboxItem: ledger.discard,
        retryOutboxItem: ledger.retry,
        discardConflictDraft: ledger.discardDraft,
        useLedgerConflictNotices: (listener: (notice: LedgerConflictNotice) => void) => {
            ledger.noticeListener = listener;
            actual.useLedgerConflictNotices(listener);
        },
    };
});

const usd = (minor: bigint) => fromUnits(minor, currencyCode('USD'));

const pendingCreate: PendingOutboxItem = {
    opId: 'op-1',
    entryId: 'entry-1',
    kind: 'createExpense',
    description: 'Dinner',
    amount: usd(300_000n),
    share: usd(100_000n),
    relatedOpIds: [],
    canCancel: true,
    status: 'waiting-network',
};

const sendingEdit: PendingOutboxItem = {
    opId: 'op-2',
    entryId: 'entry-2',
    kind: 'updateExpense',
    description: null,
    amount: null,
    share: null,
    relatedOpIds: [],
    canCancel: false,
    status: 'sending',
};

const failedCreate: FailedOutboxItem = {
    opId: 'op-3',
    entryId: 'entry-3',
    kind: 'createExpense',
    description: 'Taxi',
    amount: usd(120_000n),
    share: usd(60_000n),
    relatedOpIds: ['op-4', 'op-5'],
    canCancel: true,
    reason: 'validation',
    isRetrying: false,
    canRetry: true,
};

const overlayOf = (patch: Partial<OutboxOverlay>): OutboxOverlay => ({
    restore: 'ok',
    pending: [],
    failed: [],
    unreadableCount: 0,
    conflictDrafts: [],
    conflictDraftEntryIds: new Set(),
    count: 0,
    pendingCreates: new Set(),
    pendingUpdatesByEntryId: new Map(),
    pendingDeletes: new Set(),
    statusByOpId: new Map(),
    queuedGroupIds: new Set(),
    isStorageNotPersisted: false,
    ...patch,
});

// The controls live inside the router (the internal layout): "Open my changes" navigates.
const renderControls = () => render(<OutboxControls />, { wrapper: MemoryRouter });

const openSheet = async (): Promise<HTMLElement> => {
    await userEvent
        .setup()
        .click(screen.getByRole('button', { name: /^Unsent: \d+, open the list$/ }));
    return screen.findByRole('dialog');
};

beforeEach(() => {
    ledger.overlay = null;
    ledger.noticeListener = null;
    ledger.discard.mockResolvedValue(true);
    ledger.retry.mockResolvedValue(true);
    ledger.discardDraft.mockResolvedValue(true);
});

afterEach(() => {
    act(() => {
        useOutboxSheetStore.setState({ isOpen: false });
        useConflictDraftStore.getState().reset();
    });
    vi.unstubAllEnvs();
});

describe('03-16a part B flag off = master', () => {
    test('nothing is rendered: no badge, no banner, no sheet', () => {
        const { container } = renderControls();

        expect(container.innerHTML).toBe('');
        // R2 N2: no row, so no ledger entry is observed or added to the cache.
        expect(getDefaultTestQueryClient().getQueryCache().getAll()).toEqual([]);
    });
});

describe('03-16a part B OutboxSheet', () => {
    test('nothing queued and the restore ok: nothing is rendered', () => {
        ledger.overlay = overlayOf({});
        const { container } = renderControls();

        expect(container.innerHTML).toBe('');
    });

    test('the badge counts pending and failed ops and opens the sheet with their status and reason', async () => {
        ledger.overlay = overlayOf({
            pending: [pendingCreate, sendingEdit],
            failed: [failedCreate],
            count: 3,
        });
        renderControls();

        // R1 N1: the accessible name starts with the visible text.
        expect(screen.getByRole('button', { name: 'Unsent: 3, open the list' }));
        const sheet = await openSheet();

        expect(within(sheet).getByText('New expense · Waiting for network')).toBeTruthy();
        // R1 N3: no description and no cached entry: the kind is the title, once.
        expect(within(sheet).getByText('Expense edit')).toBeTruthy();
        expect(within(sheet).getByText('Sending')).toBeTruthy();
        expect(within(sheet).getByText('New expense · The server rejected the data')).toBeTruthy();
        // §3: "your share" of a pending expense (money.split), through `Amount`.
        expect(within(sheet).getAllByText(/Your share:/)).toHaveLength(2);
        expect(within(sheet).queryByText('The browser may delete', { exact: false })).toBeNull();
    });

    test('an op being sent offers no Cancel; Retry only for a failed op', async () => {
        ledger.overlay = overlayOf({ pending: [sendingEdit], count: 1 });
        renderControls();
        const sheet = await openSheet();

        expect(within(sheet).queryByRole('button', { name: 'Cancel operation' })).toBeNull();
        expect(within(sheet).queryByRole('button', { name: 'Retry' })).toBeNull();
    });

    test('Retry of a failed op goes through the outbox Retry', async () => {
        ledger.overlay = overlayOf({ failed: [failedCreate], count: 1 });
        renderControls();
        const sheet = await openSheet();

        await userEvent.setup().click(within(sheet).getByRole('button', { name: 'Retry' }));
        expect(ledger.retry).toHaveBeenCalledWith(failedCreate);
    });

    test('C2-15: a discard of a failed create confirms "and N related edits" and cancels them together', async () => {
        ledger.overlay = overlayOf({ failed: [failedCreate], count: 1 });
        renderControls();
        const sheet = await openSheet();
        const user = userEvent.setup();

        await user.click(within(sheet).getByRole('button', { name: 'Cancel operation' }));
        const confirm = await screen.findByRole('alertdialog');

        expect(
            within(confirm).getByText(
                'It will not be sent, and neither will 2 related edits. This cannot be undone.',
            ),
        ).toBeTruthy();
        expect(ledger.discard).not.toHaveBeenCalled();
        await user.click(within(confirm).getByRole('button', { name: 'Cancel operation' }));
        await waitFor(() => {
            expect(ledger.discard).toHaveBeenCalledWith(expect.anything(), failedCreate);
        });
    });

    test('R1 M1: a cancel that did not cancel the item (sent, being sent or gone) says so', async () => {
        ledger.discard.mockResolvedValue(false);
        ledger.overlay = overlayOf({ pending: [pendingCreate], count: 1 });
        renderControls();
        const sheet = await openSheet();
        const user = userEvent.setup();

        await user.click(within(sheet).getByRole('button', { name: 'Cancel operation' }));
        const confirm = await screen.findByRole('alertdialog');

        expect(
            within(confirm).getByText('It will not be sent. This cannot be undone.'),
        ).toBeTruthy();
        await user.click(within(confirm).getByRole('button', { name: 'Cancel operation' }));
        await waitFor(() => {
            expect(vi.mocked(toast.error).mock.calls).toEqual([
                ['It is already being sent and can no longer be cancelled'],
            ]);
        });
    });

    test('R1 N3: a delete without a description is named by the cached entry, as it is read', async () => {
        ledger.overlay = overlayOf({
            pending: [
                {
                    ...sendingEdit,
                    opId: 'op-9',
                    entryId: 'entry-9',
                    kind: 'deleteExpense',
                    status: 'queued',
                },
            ],
            count: 1,
        });
        renderControls();
        const sheet = await openSheet();

        // R2 N2: the row follows the cache (the entry is read after the sheet opened).
        act(() => {
            getDefaultTestQueryClient().setQueryData(ledgerKeys.entry('entry-9'), {
                id: 'entry-9',
                type: 'EXPENSE',
                version: '3',
                groupId: null,
                expense: { description: 'Lunch' },
            });
        });
        expect(await within(sheet).findByText('Lunch')).toBeTruthy();
        // R2 N2: observed, not fetched.
        expect(getDefaultTestQueryClient().isFetching()).toBe(0);
        expect(within(sheet).getByText('Expense deletion · Waiting to be sent')).toBeTruthy();
    });

    test('R1 L2: unreadable records count on the badge and have one row without actions', async () => {
        ledger.overlay = overlayOf({ unreadableCount: 2, count: 2 });
        renderControls();
        const sheet = await openSheet();

        expect(
            within(sheet).getByText(
                "2 records can't be read on this device (maybe from a newer app version); they are kept",
            ),
        ).toBeTruthy();
        expect(within(sheet).queryByRole('button', { name: 'Cancel operation' })).toBeNull();
        expect(within(sheet).queryByRole('button', { name: 'Retry' })).toBeNull();
    });

    test('C3-10: persisted() === false shows the storage caption', async () => {
        ledger.overlay = overlayOf({
            pending: [pendingCreate],
            count: 1,
            isStorageNotPersisted: true,
        });
        renderControls();
        const sheet = await openSheet();

        expect(within(sheet).getByText('The browser may delete', { exact: false })).toBeTruthy();
    });
});

describe('03-16a part B outboxUnavailable (§1.6)', () => {
    test('a failed restore shows the non-blocking banner and no badge', () => {
        ledger.overlay = overlayOf({ restore: 'failed' });
        renderControls();

        expect(
            screen.getByText(
                'Offline saving is unavailable. Operations on the device are preserved — restart the app',
            ),
        ).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
    });
});

describe('03-16b conflict drafts (§2.6, D28)', () => {
    const draft = {
        entryId: 'entry-9',
        groupId: 'group-1',
        parentActivityId: 'activity-9',
        description: 'Mine',
        createdAt: 1,
    };

    // The route the app is on ("Open my changes" navigates to the expense history).
    const LocationProbe = () => <output aria-label="location">{useLocation().pathname}</output>;

    const renderInRouter = () =>
        render(
            <>
                <OutboxControls />
                <LocationProbe />
            </>,
            { wrapper: MemoryRouter },
        );

    test('the badge counts drafts; a draft row offers "Open my changes" and "Discard my changes" (no request)', async () => {
        ledger.overlay = overlayOf({
            conflictDrafts: [draft],
            conflictDraftEntryIds: new Set(['entry-9']),
            count: 1,
        });
        renderInRouter();
        const sheet = await openSheet();

        expect(within(sheet).getByText('Changes not sent')).toBeTruthy();
        expect(within(sheet).getByText('Mine')).toBeTruthy();
        await userEvent
            .setup()
            .click(within(sheet).getByRole('button', { name: 'Discard my changes' }));
        expect(ledger.discardDraft).toHaveBeenCalledWith('entry-9');

        await userEvent
            .setup()
            .click(within(sheet).getByRole('button', { name: 'Open my changes' }));
        expect(useConflictDraftStore.getState().requestedEntryId).toBe('entry-9');
        expect(useOutboxSheetStore.getState().isOpen).toBe(false);
        expect(screen.getByLabelText('location').textContent).toBe('/activity/activity-9');
    });

    test('a conflict is a toast, never a dialog: changed (with "Open my changes"), not deleted, deleted', async () => {
        ledger.overlay = overlayOf({});
        renderInRouter();

        act(() => {
            ledger.noticeListener?.({
                kind: 'changed',
                entryId: 'entry-9',
                parentActivityId: 'activity-9',
            });
            ledger.noticeListener?.({
                kind: 'notDeleted',
                entryId: 'entry-8',
                parentActivityId: null,
            });
            ledger.noticeListener?.({
                kind: 'deleted',
                entryId: 'entry-7',
                parentActivityId: null,
            });
        });

        const calls = vi.mocked(toast.warning).mock.calls;

        expect(calls.map(([message]) => message)).toEqual([
            'This expense was changed by another member',
            'This expense was changed by another member, so it was not deleted',
            'The expense was deleted',
        ]);
        expect(screen.queryByRole('dialog')).toBeNull();
        const action = calls[0]?.[1]?.action;

        expect(action).toMatchObject({ label: 'Open my changes' });
        // The toast's button: its handler ignores the click event.
        const onClick: unknown =
            action && typeof action === 'object' && 'onClick' in action ? action.onClick : null;

        act(() => {
            if (typeof onClick === 'function') {
                Reflect.apply(onClick, undefined, []);
            }
        });
        await waitFor(() => {
            expect(screen.getByLabelText('location').textContent).toBe('/activity/activity-9');
        });
        expect(useConflictDraftStore.getState().requestedEntryId).toBe('entry-9');
    });
});
