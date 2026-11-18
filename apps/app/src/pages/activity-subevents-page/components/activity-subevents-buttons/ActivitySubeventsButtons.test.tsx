import { Theme } from '@radix-ui/themes';
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear } from 'idb-keyval';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { activityKeys } from 'entities/activity';
import { dashboardKeys } from 'entities/dashboard';
import { capabilitiesQueryOptions, ledgerKeys } from 'entities/ledger';
import { usersKeys } from 'entities/users';
import { getAuthSessionVersion, invalidateAuthSession } from 'helpers/authSession';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import {
    LedgerWriteRefusedError,
    startUserLedgerOutbox,
    toastLedgerWriteError,
} from 'hooks/useLedgerMutations';
import { onAccessTokenRefreshed, useAuthStore } from 'store/authStore';
import { useConflictDraftStore } from 'store/conflictDraftStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { domainExpenseEvent, domainSettlementEvent } from 'test/activityFixtures';
import { fakeAccessToken } from 'test/fakeAccessToken';
import { wireGroup } from 'test/groupFixtures';
import { setupMswServer } from 'test/mswServer';
import {
    outboxConflictDraft,
    pendingOutboxOps,
    resetOutbox,
    storeConflictDrafts,
} from 'test/outbox';
import { mountAsUserClient } from 'test/userClient';

import { ActivitySubeventsButtons } from './ActivitySubeventsButtons';

import 'fake-indexeddb/auto';
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
    useConflictDraftStore.getState().reset();
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

test('03-16b flag off = master: Edit opens the editor as before, never on a draft', async () => {
    const user = userEvent.setup();

    useConflictDraftStore.getState().requestOpen('expense-id');
    render(
        <ActivitySubeventsButtons
            parentEvent={parentEvent}
            parentActivityId={parentEvent.id}
            childEvents={[updatedEvent]}
        />,
    );
    // The request is a no-op without a draft: it opens the ordinary editor.
    useExpenseModalStore.getState().reset();
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(useExpenseModalStore.getState()).toMatchObject({
        mode: 'edit',
        description: 'Updated dinner',
    });
    expect(useConflictDraftStore.getState().openedEntryId).toBeNull();
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

describe('03-16a ledger.entry(id): what an outbox edit or delete needs (§2.9 C2-33)', () => {
    // `GET /ledger/entries/{id}`: the ids read, in order.
    const serveEntry = (): string[] => {
        const reads: string[] = [];

        server.use(
            http.get('*/ledger/entries/:id', ({ params }) => {
                reads.push(String(params.id));
                return HttpResponse.json({
                    id: String(params.id),
                    type: 'EXPENSE',
                    scope: 'USER',
                    version: '7',
                    createdAt: 1,
                    updatedAt: 1,
                });
            }),
        );
        return reads;
    };

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test('offline writes off (master): the history reads no ledger entry', async () => {
        const client = signIn();
        const reads = serveEntry();

        render(
            <ActivitySubeventsButtons
                parentEvent={parentEvent}
                parentActivityId={parentEvent.id}
                childEvents={[]}
            />,
        );
        await act(() => new Promise(resolve => setTimeout(resolve, 50)));

        expect(reads).toEqual([]);
        expect(client.getQueryState(ledgerKeys.entry('expense-id'))).toBeUndefined();
    });

    // Offline writes available: the flag, the outbox of the user restored, the capabilities.
    const withOfflineWrites = async (client: QueryClient): Promise<void> => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        await clear();
        await startUserLedgerOutbox(client, 'user-id');
        client.setQueryData(capabilitiesQueryOptions().queryKey, [
            'ledger.clientEntryId',
            'ledger.entryVersion',
            'client.minVersion',
        ]);
    };

    afterEach(() => {
        resetOutbox();
    });

    test('offline writes available: the expense is observed in the cache, a settlement and an unchangeable entry are not', async () => {
        const client = signIn();
        const reads = serveEntry();

        await withOfflineWrites(client);
        render(
            <>
                <ActivitySubeventsButtons
                    parentEvent={parentEvent}
                    parentActivityId={parentEvent.id}
                    childEvents={[]}
                />
                <ActivitySubeventsButtons
                    parentEvent={settlementEvent(false)}
                    parentActivityId="settlement-activity-id"
                    childEvents={[]}
                />
                <ActivitySubeventsButtons
                    parentEvent={domainExpenseEvent({
                        ...legacyParentEvent,
                        id: 'other-activity-id',
                        metadata: { ...legacyParentEvent.metadata, entryId: 'other-id' },
                    })}
                    parentActivityId="other-activity-id"
                    childEvents={[]}
                    canChange={false}
                />
            </>,
        );

        await waitFor(() => {
            expect(client.getQueryData(ledgerKeys.entry('expense-id'))).toEqual({
                id: 'expense-id',
                type: 'EXPENSE',
                version: '7',
                updatedAt: 1,
                groupId: null,
                expense: null,
            });
        });
        // An observer: the entry is read again with the views (focus, reconnect, invalidation).
        expect(
            client
                .getQueryCache()
                .find({ queryKey: ledgerKeys.entry('expense-id') })
                ?.getObserversCount(),
        ).toBe(1);
        expect(reads).toEqual(['expense-id']);
    });

    test('N5: once a delete of the expense is queued, its Update and Delete are disabled', async () => {
        const client = signIn();

        serveEntry();
        await withOfflineWrites(client);
        render(
            <ActivitySubeventsButtons
                parentEvent={parentEvent}
                parentActivityId={parentEvent.id}
                childEvents={[]}
            />,
        );
        await waitFor(() => {
            expect(client.getQueryData(ledgerKeys.entry('expense-id'))).toBeTruthy();
        });
        onlineManager.setOnline(false);
        const user = userEvent.setup();

        expect(screen.getByRole('button', { name: 'Update' })).toHaveProperty('disabled', false);
        await user.click(screen.getByRole('button', { name: 'Delete' }));
        await user.click(screen.getByRole('button', { name: 'Delete entry' }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete' })).toHaveProperty('disabled', true);
        });
        expect(screen.getByRole('button', { name: 'Update' })).toHaveProperty('disabled', true);
        onlineManager.setOnline(true);
    });

    // The user's outbox holds a conflict draft of the expense (§2.6), then offline writes are on.
    const withDraft = async (client: QueryClient): Promise<void> => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        await clear();
        await storeConflictDrafts('user-id', {
            'expense-id': {
                entryId: 'expense-id',
                groupId: null,
                parentActivityId: parentEvent.id,
                fields: { description: 'Mine', amount: { __wireDecimal: '55' } },
                createdAt: 5,
            },
        });
        await startUserLedgerOutbox(client, 'user-id');
        client.setQueryData(capabilitiesQueryOptions().queryKey, [
            'ledger.clientEntryId',
            'ledger.entryVersion',
            'client.minVersion',
        ]);
    };

    test('03-16b Second conflict merges: an ordinary Edit of an expense with a draft opens the form on the draft', async () => {
        const client = signIn();

        serveEntry();
        await withDraft(client);
        render(
            <ActivitySubeventsButtons
                parentEvent={parentEvent}
                parentActivityId={parentEvent.id}
                childEvents={[updatedEvent]}
            />,
        );
        await userEvent.setup().click(screen.getByRole('button', { name: 'Update' }));

        // The expense as it is now (the history's latest event) with the draft's fields on top;
        // the original stays the expense as it is now, so Save sends the draft's fields.
        expect(useExpenseModalStore.getState()).toMatchObject({
            mode: 'edit',
            description: 'Mine',
            amount: '55',
            currency: 'USD',
            editContext: { entryId: 'expense-id', original: { description: 'Updated dinner' } },
        });
        expect(useConflictDraftStore.getState().openedEntryId).toBe('expense-id');
    });

    test('03-16b "Open my changes" (a request) opens the form on the draft once', async () => {
        const client = signIn();

        serveEntry();
        await withDraft(client);
        useConflictDraftStore.getState().requestOpen('expense-id');
        render(
            <ActivitySubeventsButtons
                parentEvent={parentEvent}
                parentActivityId={parentEvent.id}
                childEvents={[]}
            />,
        );

        await waitFor(() => {
            expect(useExpenseModalStore.getState()).toMatchObject({
                isOpened: true,
                description: 'Mine',
            });
        });
        expect(useConflictDraftStore.getState()).toMatchObject({
            requestedEntryId: null,
            openedEntryId: 'expense-id',
        });
    });

    test('03-16b R1 L2: the request waits for a fresh history and is kept until an editor opened', async () => {
        const client = signIn();

        serveEntry();
        await withDraft(client);
        // The conflict invalidated the history; its refetch has not answered yet.
        await client.invalidateQueries({ queryKey: historyKey, refetchType: 'none' });
        useConflictDraftStore.getState().requestOpen('expense-id');
        render(
            <ActivitySubeventsButtons
                parentEvent={parentEvent}
                parentActivityId={parentEvent.id}
                childEvents={[]}
            />,
        );
        await act(() => new Promise(resolve => setTimeout(resolve, 20)));

        expect(useExpenseModalStore.getState().isOpened).toBe(false);
        expect(useConflictDraftStore.getState().requestedEntryId).toBe('expense-id');
        act(() => {
            client.setQueryData(historyKey, emptyHistory);
        });

        await waitFor(() => {
            expect(useExpenseModalStore.getState()).toMatchObject({
                isOpened: true,
                description: 'Mine',
            });
        });
        expect(useConflictDraftStore.getState().requestedEntryId).toBeNull();
    });

    test('03-16b R1 L2: an entry that cannot be edited does not consume the request', async () => {
        const client = signIn();

        serveEntry();
        await withDraft(client);
        useConflictDraftStore.getState().requestOpen('expense-id');
        render(
            <ActivitySubeventsButtons
                parentEvent={parentEvent}
                parentActivityId={parentEvent.id}
                childEvents={[]}
                canChange={false}
            />,
        );
        await act(() => new Promise(resolve => setTimeout(resolve, 20)));

        expect(useExpenseModalStore.getState().isOpened).toBe(false);
        expect(useConflictDraftStore.getState().requestedEntryId).toBe('expense-id');
    });

    test('03-16b R1 M1: an unreadable draft opens the ordinary editor, not marked as opened on a draft', async () => {
        const client = signIn();

        serveEntry();
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        await clear();
        await storeConflictDrafts('user-id', {
            'expense-id': {
                entryId: 'expense-id',
                groupId: null,
                parentActivityId: parentEvent.id,
                fields: { amount: 12 },
                createdAt: 5,
            },
        });
        await startUserLedgerOutbox(client, 'user-id');
        render(
            <ActivitySubeventsButtons
                parentEvent={parentEvent}
                parentActivityId={parentEvent.id}
                childEvents={[updatedEvent]}
            />,
        );
        await userEvent.setup().click(screen.getByRole('button', { name: 'Update' }));

        expect(useExpenseModalStore.getState()).toMatchObject({ description: 'Updated dinner' });
        expect(useConflictDraftStore.getState().openedEntryId).toBeNull();
        expect(outboxConflictDraft('expense-id')).not.toBeNull();
    });

    test('03-16b a reversed expense drops its draft', async () => {
        const client = signIn();

        serveEntry();
        await withDraft(client);
        expect(outboxConflictDraft('expense-id')).not.toBeNull();
        render(
            <ActivitySubeventsButtons
                parentEvent={parentEvent}
                parentActivityId={parentEvent.id}
                currentEvent={reversedEvent}
                childEvents={[reversedEvent]}
            />,
        );

        await waitFor(() => {
            expect(outboxConflictDraft('expense-id')).toBeNull();
        });
    });

    test('flag on but offline writes unavailable (no backend capabilities): no ledger entry is read or cached', async () => {
        vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
        const client = signIn();
        const reads = serveEntry();

        server.use(http.get('*/health', () => HttpResponse.json({ status: 'UP' })));
        await clear();
        await startUserLedgerOutbox(client, 'user-id');
        render(
            <ActivitySubeventsButtons
                parentEvent={parentEvent}
                parentActivityId={parentEvent.id}
                childEvents={[]}
            />,
        );
        await waitFor(() => {
            expect(client.getQueryData(capabilitiesQueryOptions().queryKey)).toEqual([]);
        });
        await act(() => new Promise(resolve => setTimeout(resolve, 50)));

        expect(reads).toEqual([]);
        expect(client.getQueryState(ledgerKeys.entry('expense-id'))).toBeUndefined();
    });
    // 03-16a part C, §2.9 C2-02: a settlement is changed only online, on two levels.
    describe('C2-02: a settlement delete or edit is online-only, an expense delete may be queued', () => {
        const renderBoth = () =>
            render(
                <>
                    <section aria-label="expense">
                        <ActivitySubeventsButtons
                            parentEvent={parentEvent}
                            parentActivityId={parentEvent.id}
                            childEvents={[]}
                        />
                    </section>
                    <section aria-label="settlement">
                        <ActivitySubeventsButtons
                            parentEvent={settlementEvent(true)}
                            parentActivityId="settlement-activity-id"
                            childEvents={[]}
                        />
                    </section>
                </>,
                { wrapper: Theme },
            );

        test('flag on, offline: the settlement Delete and Update are disabled, 0 outbox ops; the expense Delete is queued', async () => {
            const client = signIn();
            const sent = serveDelete();

            serveEntry();
            await withOfflineWrites(client);
            renderBoth();
            await waitFor(() => {
                expect(client.getQueryData(ledgerKeys.entry('expense-id'))).toBeTruthy();
            });
            act(() => {
                onlineManager.setOnline(false);
            });
            const settlement = within(screen.getByRole('region', { name: 'settlement' }));
            const expense = within(screen.getByRole('region', { name: 'expense' }));
            const settlementDelete = settlement.getByRole('button', { name: 'Delete' });
            const user = userEvent.setup();

            expect(settlementDelete).toHaveProperty('disabled', true);
            expect(settlementDelete.getAttribute('aria-disabled')).toBe('true');
            expect(settlement.getByRole('button', { name: 'Update' })).toHaveProperty(
                'disabled',
                true,
            );
            await user.click(settlementDelete.parentElement ?? settlementDelete);
            expect(screen.queryByRole('button', { name: 'Delete entry' })).toBeNull();
            expect(pendingOutboxOps()).toEqual([]);

            expect(expense.getByRole('button', { name: 'Delete' })).toHaveProperty(
                'disabled',
                false,
            );
            await user.click(expense.getByRole('button', { name: 'Delete' }));
            await user.click(screen.getByRole('button', { name: 'Delete entry' }));
            await waitFor(() => {
                expect(pendingOutboxOps().map(op => [op.kind, op.entryId])).toEqual([
                    ['deleteExpense', 'expense-id'],
                ]);
            });
            expect(sent).toEqual([]);
            act(() => {
                onlineManager.setOnline(true);
            });
        });

        test('flag on, online: the settlement DELETE goes out on the online path, nothing queued', async () => {
            const client = signIn();
            const sent = serveDelete();

            serveEntry();
            server.use(
                http.get('*/groups/group-1/activity-previews', () =>
                    HttpResponse.json({ items: [], nextCursor: null }),
                ),
                http.get('*/groups/group-1', () => HttpResponse.json(wireGroup('group-1'))),
            );
            await withOfflineWrites(client);
            renderBoth();
            const settlement = within(screen.getByRole('region', { name: 'settlement' }));
            const user = userEvent.setup();

            await user.click(settlement.getByRole('button', { name: 'Delete' }));
            await user.click(screen.getByRole('button', { name: 'Delete entry' }));

            await waitFor(() => {
                expect(sent).toEqual(['DELETE /ledger/entries/settlement-id']);
            });
            expect(pendingOutboxOps()).toEqual([]);
            expect(client.getQueryState(ledgerKeys.entry('settlement-id'))).toBeUndefined();
        });
    });
});
