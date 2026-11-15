import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { activityKeys } from 'entities/activity';
import { dashboardKeys } from 'entities/dashboard';
import { usersKeys } from 'entities/users';
import { getAuthSessionVersion, invalidateAuthSession } from 'helpers/authSession';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { LedgerWriteRefusedError, toastLedgerWriteError } from 'hooks/useLedgerMutations';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { domainExpenseEvent, domainSettlementEvent } from 'test/activityFixtures';
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

// The real module; `toastLedgerWriteError` is also recorded: its call is the moment the caller got
// the outcome of a rejected write.
vi.mock('hooks/useLedgerMutations', async importOriginal => {
    const actual = await importOriginal<typeof import('hooks/useLedgerMutations')>();

    return { ...actual, toastLedgerWriteError: vi.fn(actual.toastLedgerWriteError) };
});

const legacyParentEvent = {
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

const parentEvent = domainExpenseEvent(legacyParentEvent);

const reversedEvent = domainExpenseEvent({
    ...legacyParentEvent,
    id: 'reversed-activity-id',
    seq: 2,
    action: ACTIVITY_ACTIONS.EXPENSE_REVERSED,
    parentActivityId: legacyParentEvent.id,
});

const updatedEvent = domainExpenseEvent({
    ...legacyParentEvent,
    id: 'updated-activity-id',
    seq: 2,
    action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
    metadata: { ...legacyParentEvent.metadata, description: 'Updated dinner', amount: 40 },
    parentActivityId: legacyParentEvent.id,
});

// A payment between two friends; `inGroup` makes it a payment inside `group-1`.
const settlementEvent = (inGroup: boolean) =>
    domainSettlementEvent({
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
    });

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

const selfFeedKey = activityKeys.self({ view: 'previews' });
const historyKey = activityKeys.children(parentEvent.id);
const settlementHistoryKey = activityKeys.children('settlement-activity-id');
const emptyHistory = { pages: [], pageParams: [] };

// The expense history (`activity.children`) under `queryKey` was invalidated on this client.
const isHistoryStale = (client: QueryClient, queryKey = historyKey): boolean =>
    client.getQueryState(queryKey)?.isInvalidated === true;

// The user's activity feed (`activity.self`) was invalidated on this client.
const isFeedStale = (client: QueryClient): boolean =>
    client.getQueryState(selfFeedKey)?.isInvalidated === true;

// Records every cancel or invalidation on `client` that targets the user's activity feeds
// (`['activity','self']`), whether or not the client is cleared afterwards.
const watchSelfFeedRefreshes = (client: QueryClient): (() => unknown[]) => {
    const invalidations = vi.spyOn(client, 'invalidateQueries');
    const cancels = vi.spyOn(client, 'cancelQueries');

    return () =>
        [...invalidations.mock.calls, ...cancels.mock.calls].filter(([filters]) => {
            const key = filters?.queryKey;

            return key?.[0] === 'activity' && key[1] === 'self';
        });
};

// Signed in on the user's persisted client (the only place ledger writes run), with the
// dashboard, the friends, the user's activity feed and the expense histories cached.
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
    client.setQueryData(selfFeedKey, { pages: [], pageParams: [] });
    client.setQueryData(historyKey, emptyHistory);
    client.setQueryData(settlementHistoryKey, emptyHistory);
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
});

afterEach(() => {
    onlineManager.setOnline(true);
    useExpenseModalStore.getState().reset();
    clearLocalUserIdentity();
    useAuthStore.setState({ status: 'unknown' });
});

test('ACT-004 opens the shared editor from the latest event of the loaded history', async () => {
    const user = userEvent.setup();

    render(
        <ActivitySubeventsButtons
            parentEvent={parentEvent}
            parentActivityId={parentEvent.id}
            childEvents={[updatedEvent]}
        />,
    );

    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(useExpenseModalStore.getState()).toMatchObject({
        isOpened: true,
        mode: 'edit',
        description: 'Updated dinner',
        amount: '40',
        currency: 'USD',
        editContext: { entryId: 'expense-id', parentActivityId: parentEvent.id },
    });
});

test('hides edit and delete actions when the latest event is reversed', () => {
    render(
        <ActivitySubeventsButtons
            parentEvent={parentEvent}
            parentActivityId={parentEvent.id}
            currentEvent={reversedEvent}
            childEvents={[reversedEvent]}
        />,
    );

    expect(screen.queryByText('Update')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
});

test('ACT-004 an unreadable event in the loaded history disables edit and delete', async () => {
    const user = userEvent.setup();

    render(
        <ActivitySubeventsButtons
            parentEvent={parentEvent}
            parentActivityId={parentEvent.id}
            childEvents={[updatedEvent]}
            canChange={false}
        />,
    );

    expect(screen.getByRole('button', { name: 'Update' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(useExpenseModalStore.getState().isOpened).toBe(false);
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
    const client = signIn();
    const sent = serveDelete();

    render(
        <ActivitySubeventsButtons
            parentEvent={parentEvent}
            parentActivityId={parentEvent.id}
            childEvents={[]}
        />,
    );
    await confirmDelete();

    await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Entry deleted successfully.');
    });
    expect(sent).toEqual(['DELETE /ledger/entries/expense-id']);
    expect(toast.error).not.toHaveBeenCalled();
    expect(isFeedStale(client)).toBe(true);
    expect(isHistoryStale(client)).toBe(true);
});

test('a delete invalidates the history under the route id it is keyed by', async () => {
    const client = signIn();
    const routeHistoryKey = activityKeys.children('route-activity-id');

    client.setQueryData(routeHistoryKey, emptyHistory);
    serveDelete();
    render(
        <ActivitySubeventsButtons
            parentEvent={parentEvent}
            parentActivityId="route-activity-id"
            childEvents={[]}
        />,
    );
    await confirmDelete();

    await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Entry deleted successfully.');
    });
    expect(isHistoryStale(client, routeHistoryKey)).toBe(true);
    expect(isHistoryStale(client)).toBe(false);
});

test('the delete button is disabled while the delete request runs (the mutation state)', async () => {
    signIn();
    const gate = deferred();
    const sent = serveDelete({ gate });

    render(
        <ActivitySubeventsButtons
            parentEvent={parentEvent}
            parentActivityId={parentEvent.id}
            childEvents={[]}
        />,
    );
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

test('a failed delete shows the translated API error and marks the feed and the open history stale', async () => {
    const client = signIn();
    serveDelete({ status: 404 });

    render(
        <ActivitySubeventsButtons
            parentEvent={parentEvent}
            parentActivityId={parentEvent.id}
            childEvents={[]}
        />,
    );
    await confirmDelete();

    await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Ledger entry was not found');
    });
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => {
        expect(isFeedStale(client)).toBe(true);
    });
    await waitFor(() => {
        expect(isHistoryStale(client)).toBe(true);
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
    render(
        <ActivitySubeventsButtons
            parentEvent={settlementEvent(true)}
            parentActivityId="settlement-activity-id"
            childEvents={[]}
        />,
    );
    await confirmDelete();

    await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Entry deleted successfully.');
    });
    expect(sent).toEqual(['DELETE /ledger/entries/settlement-id']);
    expect(groupReads).toHaveBeenCalledOnce();
    expect(client.getQueryState(dashboardKeys.balances())?.isInvalidated).toBe(true);
    expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(false);
    expect(isFeedStale(client)).toBe(true);
});

test('deleting a settlement between friends sends one DELETE and reloads the friends balances', async () => {
    const client = signIn();
    const sent = serveDelete();

    render(
        <ActivitySubeventsButtons
            parentEvent={settlementEvent(false)}
            parentActivityId="settlement-activity-id"
            childEvents={[]}
        />,
    );
    await confirmDelete();

    await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Entry deleted successfully.');
    });
    expect(sent).toEqual(['DELETE /ledger/entries/settlement-id']);
    expect(client.getQueryState(dashboardKeys.balances())?.isInvalidated).toBe(true);
    expect(client.getQueryState(usersKeys.known())?.isInvalidated).toBe(true);
    expect(isHistoryStale(client, settlementHistoryKey)).toBe(true);
});

// The history page keeps the dialog mounted while its history refetches (the page test covers it).
test('a settlement delete the server refuses (403) shows the translated error and keeps the dialog open', async () => {
    const client = signIn();
    const sent = serveDelete({ status: 403, code: 'LEDGER.FORBIDDEN' });

    render(
        <ActivitySubeventsButtons
            parentEvent={settlementEvent(false)}
            parentActivityId="settlement-activity-id"
            childEvents={[]}
        />,
    );
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
    await waitFor(() => {
        expect(isFeedStale(client)).toBe(true);
    });
    await waitFor(() => {
        expect(isHistoryStale(client, settlementHistoryKey)).toBe(true);
    });
    expect(screen.getByRole('button', { name: 'Delete entry' })).toBeTruthy();
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
            const selfFeedRefreshes = watchSelfFeedRefreshes(signIn());
            const gate = deferred();
            const sent = serveDelete({ gate, status });

            render(
                <ActivitySubeventsButtons
                    parentEvent={parentEvent}
                    parentActivityId={parentEvent.id}
                    childEvents={[]}
                />,
            );
            await confirmDelete();
            await waitFor(() => {
                expect(sent).toHaveLength(1);
            });
            endSession();
            gate.resolve();
            // The delete rejected as an ended session: the caller has its outcome.
            await waitFor(() => {
                expect(toastLedgerWriteError).toHaveBeenCalledWith(
                    new LedgerWriteRefusedError('session'),
                    expect.any(String),
                );
            });
            expect(deleteButton()).toHaveProperty('disabled', false);

            expect(toast.success).not.toHaveBeenCalled();
            expect(toast.error).not.toHaveBeenCalled();
            expect(selfFeedRefreshes()).toEqual([]);
        },
    );
});

test('an offline delete is refused with a toast and nothing is sent after the reconnect', async () => {
    signIn();
    const sent = serveDelete();

    onlineManager.setOnline(false);
    render(
        <ActivitySubeventsButtons
            parentEvent={parentEvent}
            parentActivityId={parentEvent.id}
            childEvents={[]}
        />,
    );
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
