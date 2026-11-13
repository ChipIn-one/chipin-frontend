import { MutationObserver, type MutationObserverOptions } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { CreateLedgerEntryParams, UpdateLedgerExpenseParams } from 'api/chipin.types';
import { getAuthSessionVersion, invalidateAuthSession } from 'helpers/authSession';
import { ApiError } from 'shared/api/client';
import { MoneyWireError } from 'shared/money';
import { clearUserData } from 'shared/offline/clearUserData';
import { cachesByUser } from 'shared/offline/userCaches';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import {
    createExpenseMutationOptions,
    type CreateExpenseParams,
    deleteLedgerEntryMutationOptions,
    type DeleteLedgerEntryParams,
    ledgerOnlineMutationKeys,
    type LedgerWriteEffects,
    updateExpenseMutationOptions,
    type UpdateExpenseParams,
} from './mutations';

const server = setupMswServer();

interface SentRequest {
    method: string;
    path: string;
    text: string;
}

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

const onEntryWritten = vi.fn<LedgerWriteEffects['onEntryWritten']>();
const effects: LedgerWriteEffects = { onEntryWritten };

// The ledger endpoints: every request is recorded with its body text; `gate` holds the answer.
const serveLedger = (status: number | 'no-response' = 200, gate?: Deferred): SentRequest[] => {
    const sent: SentRequest[] = [];
    const answer = async ({ request }: { request: Request }): Promise<Response> => {
        sent.push({
            method: request.method,
            path: new URL(request.url).pathname.replace(/^.*\/ledger/, '/ledger'),
            text: await request.text(),
        });
        await gate?.promise;
        if (status === 'no-response') {
            return HttpResponse.error();
        }
        if (status >= 400) {
            return HttpResponse.json({ code: 'LEDGER.ENTRY_NOT_FOUND' }, { status });
        }
        return request.method === 'DELETE'
            ? new HttpResponse(null, { status: 204 })
            : HttpResponse.json({ id: 'entry-1', type: 'EXPENSE' });
    };

    server.use(
        http.post('*/ledger/entries', answer),
        http.patch('*/ledger/entries/:id', answer),
        http.delete('*/ledger/entries/:id', answer),
    );
    return sent;
};

// Every write runs on the signed-in user's persisted client, as the hooks send it.
const run = <Variables>(
    options: MutationObserverOptions<void, Error, Variables>,
    variables: Variables,
): Promise<void> => new MutationObserver(mountAsUserClient(), options).mutate(variables);

const create = (params: CreateExpenseParams): Promise<void> =>
    run(createExpenseMutationOptions(effects), {
        ...params,
        sessionVersion: getAuthSessionVersion(),
    });

const update = (params: UpdateExpenseParams): Promise<void> =>
    run(updateExpenseMutationOptions(effects), {
        ...params,
        sessionVersion: getAuthSessionVersion(),
    });

const remove = (params: DeleteLedgerEntryParams): Promise<void> =>
    run(deleteLedgerEntryMutationOptions(effects), {
        ...params,
        sessionVersion: getAuthSessionVersion(),
    });

const expense: CreateLedgerEntryParams = {
    groupId: 'group-1',
    description: 'Dinner',
    amount: 85.5,
    date: 1_717_200_000,
    payerId: 'user-1',
    participantIds: ['user-1', 'user-2'],
    currency: 'USD',
    category: 'food',
    sharingMode: { type: 'AUTO' },
};

// The body the legacy client (`api/ledgerApi.createExpense`, `JSON.stringify`) sent for a payload.
const legacyCreateText = ({ groupId, sharingMode, category, ...rest }: CreateLedgerEntryParams) =>
    JSON.stringify({
        type: 'EXPENSE',
        ...(groupId && { groupId }),
        expense: {
            ...rest,
            category: category ?? null,
            sharingMode: sharingMode ?? { type: 'AUTO' },
        },
    });

beforeEach(() => {
    vi.clearAllMocks();
    onEntryWritten.mockResolvedValue(undefined);
});

test('the online ledger keys are the set of spec 03 §2.1; every mutation is online-only without retry', () => {
    expect(ledgerOnlineMutationKeys).toEqual({
        createEntry: ['ledger', 'online', 'createEntry'],
        updateEntry: ['ledger', 'online', 'updateEntry'],
        deleteEntry: ['ledger', 'online', 'deleteEntry'],
    });
    expect(
        [
            createExpenseMutationOptions(effects),
            updateExpenseMutationOptions(effects),
            deleteLedgerEntryMutationOptions(effects),
        ].map(({ mutationKey, networkMode, retry }) => ({ mutationKey, networkMode, retry })),
    ).toEqual(
        Object.values(ledgerOnlineMutationKeys).map(mutationKey => ({
            mutationKey,
            networkMode: 'online',
            retry: false,
        })),
    );
});

describe('create an expense', () => {
    test.each<[string, CreateLedgerEntryParams]>([
        ['an equal split in a group', expense],
        [
            'exact amounts between friends',
            {
                ...expense,
                groupId: undefined,
                amount: 100.25,
                category: null,
                sharingMode: { type: 'EXACT', customShares: { 'user-1': 60.2, 'user-2': 40.05 } },
            },
        ],
        [
            'percentages',
            {
                ...expense,
                amount: 0.1,
                sharingMode: {
                    type: 'PERCENTAGE',
                    percentageShares: { 'user-1': 33.5, 'user-2': 66.5 },
                },
            },
        ],
        [
            'share weights',
            {
                ...expense,
                amount: 1200,
                sharingMode: { type: 'SHARES', shares: { 'user-1': 1, 'user-2': 2 } },
            },
        ],
    ])(
        'sends the same request text as the legacy client, without an id: %s',
        async (_name, payload) => {
            const sent = serveLedger();

            await create({ expense: payload });

            expect(sent).toEqual([
                { method: 'POST', path: '/ledger/entries', text: legacyCreateText(payload) },
            ]);
            expect(sent[0]?.text).not.toContain('"id"');
        },
    );

    test('an amount that is not a plain decimal is rejected before any request', async () => {
        const sent = serveLedger();

        await expect(create({ expense: { ...expense, amount: 1e-7 } })).rejects.toBeInstanceOf(
            MoneyWireError,
        );
        await expect(
            create({
                expense: {
                    ...expense,
                    sharingMode: { type: 'SHARES', shares: { 'user-1': Number.NaN } },
                },
            }),
        ).rejects.toBeInstanceOf(MoneyWireError);
        expect(sent).toEqual([]);
        expect(onEntryWritten).not.toHaveBeenCalled();
    });

    test('after a group expense the group and the open activity history are read again', async () => {
        serveLedger();

        await create({ expense, parentActivityId: 'activity-1' });

        expect(onEntryWritten.mock.calls).toEqual([
            [{ groupId: 'group-1', parentActivityId: 'activity-1' }],
        ]);
    });

    test('settles only after its views have reloaded, and a failed reload does not fail the write', async () => {
        serveLedger();
        const reload = deferred();
        let isSettled = false;

        onEntryWritten.mockReturnValueOnce(
            reload.promise.then(() => Promise.reject(new Error('reload failed'))),
        );
        const write = create({ expense: { ...expense, groupId: undefined } }).then(() => {
            isSettled = true;
        });

        await vi.waitFor(() => {
            expect(onEntryWritten).toHaveBeenCalledWith({
                groupId: undefined,
                parentActivityId: undefined,
            });
        });
        expect(isSettled).toBe(false);
        reload.resolve();
        await expect(write).resolves.toBeUndefined();
    });
});

describe('update an expense', () => {
    // Patches in the key order `buildExpenseUpdateParams` writes them: the split block last.
    const split = { amount: 92, participantIds: ['user-1', 'user-2'] };

    test.each<[string, UpdateLedgerExpenseParams['expense']]>([
        ['only the changed fields', { description: 'Lunch' }],
        [
            'an equal split',
            { description: null, currency: 'EUR', ...split, sharingMode: { type: 'AUTO' } },
        ],
        [
            'exact amounts',
            {
                payerId: 'user-2',
                category: null,
                ...split,
                sharingMode: { type: 'EXACT', customShares: { 'user-1': 50.5, 'user-2': 41.5 } },
            },
        ],
        [
            'percentages',
            {
                ...split,
                sharingMode: {
                    type: 'PERCENTAGE',
                    percentageShares: { 'user-1': 33.5, 'user-2': 66.5 },
                },
            },
        ],
        [
            'share weights',
            { ...split, sharingMode: { type: 'SHARES', shares: { 'user-1': 1, 'user-2': 2 } } },
        ],
    ])('sends the same request text as the legacy client: %s', async (_name, expensePatch) => {
        const sent = serveLedger();
        const entry: UpdateLedgerExpenseParams = { type: 'EXPENSE', expense: expensePatch };

        await update({ entryId: 'entry-1', entry, groupId: 'group-1', parentActivityId: 'a-1' });

        // The legacy client (`api/ledgerApi.updateExpense`) sent the patch as it was built.
        expect(sent).toEqual([
            { method: 'PATCH', path: '/ledger/entries/entry-1', text: JSON.stringify(entry) },
        ]);
        expect(onEntryWritten.mock.calls).toEqual([
            [{ groupId: 'group-1', parentActivityId: 'a-1' }],
        ]);
    });
});

describe('delete a ledger entry', () => {
    test('sends DELETE for the entry and reads its views again', async () => {
        const sent = serveLedger();

        await remove({ entryId: 'entry-1', parentActivityId: 'activity-1' });

        expect(sent).toEqual([{ method: 'DELETE', path: '/ledger/entries/entry-1', text: '' }]);
        expect(onEntryWritten.mock.calls).toEqual([
            [{ groupId: undefined, parentActivityId: 'activity-1' }],
        ]);
    });
});

const patch: UpdateLedgerExpenseParams = { type: 'EXPENSE', expense: { description: 'Lunch' } };

// One write of each kind, in a group and from an open activity history.
const writes: [string, () => Promise<void>][] = [
    ['create', () => create({ expense, parentActivityId: 'activity-1' })],
    [
        'update',
        () =>
            update({
                entryId: 'entry-1',
                entry: patch,
                groupId: 'group-1',
                parentActivityId: 'activity-1',
            }),
    ],
    [
        'delete',
        () => remove({ entryId: 'entry-1', groupId: 'group-1', parentActivityId: 'activity-1' }),
    ],
];

describe('a rejected or unanswered request', () => {
    // Spec 03 §2.1: the refresh runs on settle. A 404/409 means the entry on screen is stale, and
    // a write without an answer may be committed.
    describe.each<[string, number | 'no-response']>([
        ['a 4xx answer', 404],
        ['a 5xx answer', 500],
        ['no response', 'no-response'],
    ])('%s', (_name, status) => {
        test.each(writes)('a %s fails and its views are read again', async (_kind, send) => {
            serveLedger(status);

            const failure: unknown = await send().then(
                () => null,
                (error: unknown) => error,
            );

            if (status === 'no-response') {
                expect(failure).toBeInstanceOf(Error);
                expect(failure).not.toBeInstanceOf(ApiError);
            } else {
                expect(failure).toBeInstanceOf(ApiError);
                expect(failure).toMatchObject({ status, code: 'LEDGER.ENTRY_NOT_FOUND' });
            }
            expect(onEntryWritten.mock.calls).toEqual([
                [{ groupId: 'group-1', parentActivityId: 'activity-1' }],
            ]);
        });
    });

    test('the write fails only after its views have reloaded', async () => {
        serveLedger(409);
        const reload = deferred();
        let isSettled = false;

        onEntryWritten.mockReturnValueOnce(reload.promise);
        const write = remove({ entryId: 'entry-1' }).catch(() => {
            isSettled = true;
        });

        await vi.waitFor(() => {
            expect(onEntryWritten).toHaveBeenCalled();
        });
        expect(isSettled).toBe(false);
        reload.resolve();
        await write;
        expect(isSettled).toBe(true);
    });
});

describe('a write whose session ended during the request', () => {
    test.each(writes)(
        'a %s answered after a sign-out reloads nothing for the next user',
        async (_kind, send) => {
            const gate = deferred();
            const sent = serveLedger(200, gate);
            const write = send();

            await vi.waitFor(() => {
                expect(sent).toHaveLength(1);
            });
            invalidateAuthSession();
            gate.resolve();
            await write;

            expect(onEntryWritten).not.toHaveBeenCalled();
        },
    );

    // Another tab switched the account and this tab's token refresh found it: the session version
    // stays, the previous user's client is dropped (`clearUserData`).
    test.each([200, 404])(
        'a write answered %i after its user client was dropped reloads nothing for the next user',
        async status => {
            const gate = deferred();
            const sent = serveLedger(status, gate);
            const sessionVersion = getAuthSessionVersion();
            const pending = writes.map(([, send]) => send().catch(() => undefined));

            await vi.waitFor(() => {
                expect(sent).toHaveLength(3);
            });
            [...cachesByUser.keys()].forEach(userId => {
                void clearUserData(userId, () => undefined);
            });
            expect(getAuthSessionVersion()).toBe(sessionVersion);
            gate.resolve();
            await Promise.all(pending);

            expect(onEntryWritten).not.toHaveBeenCalled();
        },
    );
});
