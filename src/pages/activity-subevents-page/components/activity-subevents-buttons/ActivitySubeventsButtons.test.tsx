import { onlineManager } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { useActivityStore } from 'store/activity-store';
import { useAuthStore } from 'store/authStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useLoadingStore } from 'store/loadingStore';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import { ActivitySubeventsButtons } from './ActivitySubeventsButtons';

import 'i18n/index';

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

const parentEvent = {
    id: 'activity-id',
    seq: 1,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
    actorUserId: 'user-id',
    actorSnapshot: { displayName: 'Alex', picture: null },
    subjectType: 'expense',
    subjectId: 'expense-id',
    groupId: null,
    metadata: {
        type: 'expense',
        entryId: 'expense-id',
        groupId: null,
        groupName: null,
        description: 'Dinner',
        amount: 30,
        currency: 'USD',
        payerId: 'user-id',
        payerDisplayName: 'Alex',
        shares: [],
    },
    createdAt: 1_785_328_628,
    parentActivityId: null,
} satisfies AppEvent;

const reversedEvent = {
    ...parentEvent,
    id: 'reversed-activity-id',
    seq: 2,
    action: ACTIVITY_ACTIONS.EXPENSE_REVERSED,
    parentActivityId: parentEvent.id,
} satisfies AppEvent;

const server = setupMswServer();

interface Deferred {
    promise: Promise<void>;
    resolve: () => void;
}

const deferred = (): Deferred => {
    let resolve = (): void => undefined;
    const promise = new Promise<void>(done => {
        resolve = done;
    });

    return { promise, resolve };
};

const fetchSetActivity = vi.fn(() => Promise.resolve());
const fetchSetActivitySubevents = vi.fn(() => Promise.resolve());
const initialActivity = useActivityStore.getState();

// Signed in on the user's persisted client: the only place ledger writes run.
const signIn = (): void => {
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    saveLocalUser({
        id: 'user-id',
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
    mountAsUserClient('user-id');
};

// `DELETE /ledger/entries/{id}`: `sent` lists the requests; `gate` holds the answer.
const serveDelete = ({ gate, status = 204 }: { gate?: Deferred; status?: number } = {}) => {
    const sent: string[] = [];

    server.use(
        http.delete('*/ledger/entries/:id', async ({ request }) => {
            sent.push(`DELETE ${new URL(request.url).pathname.replace(/^.*\/ledger/, '/ledger')}`);
            await gate?.promise;
            return status === 204
                ? new HttpResponse(null, { status })
                : HttpResponse.json({ code: 'LEDGER.NOT_FOUND' }, { status });
        }),
    );
    return sent;
};

beforeEach(() => {
    vi.clearAllMocks();
    useActivityStore.setState({ subevents: [], fetchSetActivity, fetchSetActivitySubevents });
    useLoadingStore.getState().setInitialLoadingStore();
});

afterEach(() => {
    onlineManager.setOnline(true);
    useActivityStore.setState(initialActivity, true);
    useExpenseModalStore.getState().reset();
    clearLocalUserIdentity();
    useAuthStore.setState({ status: 'unknown' });
});

test('opens the shared editor from the current activity snapshot', async () => {
    const user = userEvent.setup();
    const initializeEdit = vi.fn();
    const prepareExpenseEdit = vi.fn().mockReturnValue({ mode: 'edit' });
    const originalInitializeEdit = useExpenseModalStore.getState().initializeEdit;

    useActivityStore.setState({ prepareExpenseEdit });
    useExpenseModalStore.setState({ initializeEdit });
    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);

    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(prepareExpenseEdit).toHaveBeenCalledWith({
        parentEvent,
        childEvents: [],
        parentActivityId: parentEvent.id,
    });
    expect(initializeEdit).toHaveBeenCalledWith({ mode: 'edit' });

    useExpenseModalStore.setState({ initializeEdit: originalInitializeEdit });
});

test('hides edit and delete actions when the latest event is reversed', () => {
    render(
        <ActivitySubeventsButtons
            parentEvent={parentEvent}
            currentEvent={reversedEvent}
            childEvents={[reversedEvent]}
        />,
    );

    expect(screen.queryByText('Update')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
});

// The trigger, also while the open confirmation dialog hides it from the accessibility tree.
const deleteButton = (): HTMLElement =>
    screen.getByRole('button', { name: 'Delete', hidden: true });

const confirmDelete = async (): Promise<void> => {
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
};

test('deletes the entry from the activity history: one DELETE, a toast, the history and the feeds reload', async () => {
    signIn();
    const sent = serveDelete();

    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);
    await confirmDelete();

    await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Entry deleted successfully.');
    });
    expect(sent).toEqual(['DELETE /ledger/entries/expense-id']);
    expect(toast.error).not.toHaveBeenCalled();
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
    expect(fetchSetActivitySubevents).toHaveBeenCalledWith({
        parentActivityId: parentEvent.id,
        category: undefined,
        force: true,
    });
});

test('the delete button is disabled while the delete request runs (the mutation state)', async () => {
    signIn();
    const gate = deferred();
    const sent = serveDelete({ gate });

    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);
    await confirmDelete();

    await waitFor(() => {
        expect(deleteButton()).toHaveProperty('disabled', true);
    });
    gate.resolve();
    await waitFor(() => {
        expect(deleteButton()).toHaveProperty('disabled', false);
    });
    expect(sent).toHaveLength(1);
});

test('a failed delete shows the translated API error and reloads nothing', async () => {
    signIn();
    serveDelete({ status: 404 });

    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);
    await confirmDelete();

    await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Ledger entry was not found');
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(fetchSetActivity).not.toHaveBeenCalled();
});

test('an offline delete is refused with a toast and nothing is sent after the reconnect', async () => {
    signIn();
    const sent = serveDelete();

    onlineManager.setOnline(false);
    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);
    await confirmDelete();

    await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('No internet connection');
    });
    act(() => {
        onlineManager.setOnline(true);
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(sent).toEqual([]);
});
