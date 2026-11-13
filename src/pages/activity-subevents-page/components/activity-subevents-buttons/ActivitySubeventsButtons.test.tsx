import { onlineManager } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { dashboardKeys } from 'entities/dashboard';
import { usersKeys } from 'entities/users';
import { getAuthSessionVersion, invalidateAuthSession } from 'helpers/authSession';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { useActivityStore } from 'store/activity-store';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useLoadingStore } from 'store/loadingStore';
import { fakeAccessToken } from 'test/fakeAccessToken';
import { wireGroup } from 'test/groupFixtures';
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

// A payment between two friends; `inGroup` makes it a payment inside `group-1`.
const settlementEvent = (inGroup: boolean) =>
    ({
        id: 'settlement-activity-id',
        seq: 1,
        domain: 'LEDGER',
        action: ACTIVITY_ACTIONS.SETTLEMENT_CREATED,
        actorUserId: 'user-id',
        actorSnapshot: { displayName: 'Alex', picture: null },
        subjectType: 'settlement',
        subjectId: 'settlement-id',
        groupId: inGroup ? 'group-1' : null,
        metadata: {
            type: 'settlement',
            entryId: 'settlement-id',
            groupId: inGroup ? 'group-1' : null,
            groupName: inGroup ? 'Trip' : null,
            amount: 12,
            currency: 'USD',
            fromDisplayName: 'Alex',
            toDisplayName: 'Sam',
        },
        createdAt: 1_785_328_628,
        parentActivityId: null,
    }) satisfies AppEvent;

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
const signIn = () => {
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
    const client = mountAsUserClient('user-id');

    client.setQueryData(dashboardKeys.balances(), []);
    client.setQueryData(usersKeys.known(), []);
    return client;
};

// `DELETE /ledger/entries/{id}`: `sent` lists the requests; `gate` holds the answer.
const serveDelete = ({
    gate,
    status = 204,
    code = 'LEDGER.NOT_FOUND',
}: { gate?: Deferred; status?: number; code?: string } = {}) => {
    const sent: string[] = [];

    server.use(
        http.delete('*/ledger/entries/:id', async ({ request }) => {
            sent.push(`DELETE ${new URL(request.url).pathname.replace(/^.*\/ledger/, '/ledger')}`);
            await gate?.promise;
            return status === 204
                ? new HttpResponse(null, { status })
                : HttpResponse.json({ code }, { status });
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

test('a failed delete shows the translated API error and reads the history again (the entry on screen is stale)', async () => {
    signIn();
    serveDelete({ status: 404 });

    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);
    await confirmDelete();

    await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Ledger entry was not found');
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
    expect(fetchSetActivitySubevents).toHaveBeenCalledWith({
        parentActivityId: parentEvent.id,
        category: undefined,
        force: true,
    });
});

test('deleting a settlement in a group sends one DELETE and reads the group again, not the friends', async () => {
    const client = signIn();
    const sent = serveDelete();
    const groupReads = vi.fn();

    server.use(
        http.get('*/groups/group-1/activity-previews', () =>
            HttpResponse.json({ items: [], nextCursor: null }),
        ),
        http.get('*/groups/group-1', () => {
            groupReads();
            return HttpResponse.json(wireGroup('group-1'));
        }),
    );
    render(<ActivitySubeventsButtons parentEvent={settlementEvent(true)} />);
    await confirmDelete();

    await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Entry deleted successfully.');
    });
    expect(sent).toEqual(['DELETE /ledger/entries/settlement-id']);
    expect(groupReads).toHaveBeenCalledOnce();
    expect(client.getQueryState(dashboardKeys.balances())?.isInvalidated).toBe(true);
    expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(false);
    expect(fetchSetActivity).toHaveBeenCalledWith(true);
});

test('deleting a settlement between friends sends one DELETE and reloads the friends balances', async () => {
    const client = signIn();
    const sent = serveDelete();

    render(<ActivitySubeventsButtons parentEvent={settlementEvent(false)} />);
    await confirmDelete();

    await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Entry deleted successfully.');
    });
    expect(sent).toEqual(['DELETE /ledger/entries/settlement-id']);
    expect(client.getQueryState(dashboardKeys.balances())?.isInvalidated).toBe(true);
    expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(true);
    expect(fetchSetActivitySubevents).toHaveBeenCalledWith({
        parentActivityId: 'settlement-activity-id',
        category: undefined,
        force: true,
    });
});

test('a settlement delete the server refuses (403) shows the translated error and keeps the dialog open', async () => {
    signIn();
    const sent = serveDelete({ status: 403, code: 'LEDGER.FORBIDDEN' });

    render(<ActivitySubeventsButtons parentEvent={settlementEvent(false)} />);
    await confirmDelete();

    await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
            'You do not have permission to access this ledger entry',
        );
    });
    expect(sent).toHaveLength(1);
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Delete entry' })).toHaveProperty(
            'disabled',
            false,
        );
    });
});

// Another tab switched the account: this tab's token refresh returns the other user's token. The
// auth session version stays, the previous user's data and client go (spec 03 §1.5).
const switchAccountInAnotherTab = (): void => {
    const sessionVersion = getAuthSessionVersion();

    // The data of the next user, which the switch loads: none of it matters here.
    server.use(
        http.get('*/users/*', () => HttpResponse.json({}, { status: 500 })),
        http.get('*/groups', () => HttpResponse.json({ items: [], nextCursor: null })),
    );
    act(() => {
        onAccessTokenRefreshed(fakeAccessToken('user-2'));
    });
    expect(getAuthSessionVersion()).toBe(sessionVersion);
};

describe.each<[string, () => void]>([
    ['a sign-out', invalidateAuthSession],
    ['an account switch in another tab', switchAccountInAnotherTab],
])('a delete answered after %s', (_name, endSession) => {
    test.each<[string, number]>([
        ['done', 204],
        ['rejected', 404],
    ])(
        'a %s delete shows no toast in the next session and reloads nothing',
        async (_outcome, status) => {
            signIn();
            const gate = deferred();
            const sent = serveDelete({ gate, status });

            render(<ActivitySubeventsButtons parentEvent={parentEvent} />);
            await confirmDelete();
            await waitFor(() => {
                expect(sent).toHaveLength(1);
            });
            endSession();
            gate.resolve();
            await waitFor(() => {
                expect(deleteButton()).toHaveProperty('disabled', false);
            });
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(toast.success).not.toHaveBeenCalled();
            expect(toast.error).not.toHaveBeenCalled();
            expect(fetchSetActivity).not.toHaveBeenCalled();
            expect(fetchSetActivitySubevents).not.toHaveBeenCalled();
        },
    );
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
