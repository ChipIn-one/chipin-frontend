// The expense history page on the real `activity.children` query (spec 03 §6 row 5, 12c).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import ActivitySubeventsPage from './ActivitySubeventsPage';

import 'i18n/index';

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('components/nav-bars', () => ({
    MobileNavBar: () => null,
}));

const server = setupMswServer();

const parentEvent = {
    id: 'activity-1',
    seq: 1,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
    actorUserId: 'user-1',
    actorSnapshot: { displayName: 'Alex', picture: null },
    subjectType: 'expense',
    subjectId: 'expense-1',
    groupId: null,
    metadata: {
        type: 'expense',
        entryId: 'expense-1',
        groupId: null,
        groupName: null,
        description: 'Dinner',
        amount: 30,
        currency: 'USD',
        payerId: 'user-1',
        payerDisplayName: 'Alex',
        shares: [
            { userId: 'user-1', displayName: 'Alex', shareAmount: 15, currency: 'USD' },
            { userId: 'user-2', displayName: 'Sam', shareAmount: 15, currency: 'USD' },
        ],
    },
    createdAt: 1_785_328_628,
    parentActivityId: null,
} satisfies AppEvent;

const updatedEvent = {
    ...parentEvent,
    id: 'activity-2',
    seq: 2,
    action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
    metadata: { ...parentEvent.metadata, description: 'Updated dinner' },
    parentActivityId: parentEvent.id,
} satisfies AppEvent;

beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    saveLocalUser({
        id: 'user-1',
        settings: {
            defaultCurrency: 'USD',
            defaultCategory: 'food',
            timeFormat: '24h',
            language: 'en',
            theme: 'system',
            simplifyDebts: true,
            skipCategory: false,
            soloModeByDefault: false,
            saveGroupExpensesToSolo: false,
            sex: 'male',
        },
    });
    mountAsUserClient();
});

afterEach(() => {
    clearLocalUserIdentity();
    useAuthStore.setState({ status: 'unknown' });
});

// The history of `activity-1` and a delete answered with `deleteStatus`; returns the count of
// history reads.
const serve = (deleteStatus: number): (() => number) => {
    let historyReads = 0;

    server.use(
        http.get('*/users/self/activities/:parentActivityId/children', () => {
            historyReads += 1;
            return HttpResponse.json({
                parent: parentEvent,
                items: [updatedEvent],
                nextCursor: null,
            });
        }),
        http.delete('*/ledger/entries/:id', () =>
            HttpResponse.json({ code: 'LEDGER.FORBIDDEN' }, { status: deleteStatus }),
        ),
        http.get('*/users/self/known', () => HttpResponse.json({ items: [], nextCursor: null })),
    );
    return () => historyReads;
};

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/activity/activity-1']}>
            <Routes>
                <Route path="/activity/:parentActivityId" element={<ActivitySubeventsPage />} />
            </Routes>
        </MemoryRouter>,
    );

// Spec 03 §6 row 6 (03-13 rule, 12c): a failed write reloads the history too, now that the reload
// keeps the shown events: the page is not blanked and the open delete dialog stays open.
test('a failed delete reads the history again while it stays shown and the delete dialog stays open', async () => {
    const user = userEvent.setup();
    const historyReads = serve(403);

    renderPage();
    const [deleteTrigger] = await screen.findAllByRole('button', { name: 'Delete' });

    expect(historyReads()).toBe(1);
    if (!deleteTrigger) {
        throw new Error('The delete button is not shown');
    }
    await user.click(deleteTrigger);
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));

    await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
            'You do not have permission to access this ledger entry',
        );
    });
    await waitFor(() => {
        expect(historyReads()).toBe(2);
    });
    expect(screen.getByRole('button', { name: 'Delete entry' })).toBeTruthy();
    expect(screen.getAllByText('Updated dinner')).not.toHaveLength(0);
});
