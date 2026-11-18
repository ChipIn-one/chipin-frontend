import { MutationObserver, type MutationObserverOptions } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getAuthSessionVersion, invalidateAuthSession } from 'helpers/authSession';
import { ApiError, InvalidPathSegmentError } from 'shared/api/client';
import { currencyCode, fromUnits, type Money, MoneyWireError } from 'shared/money';
import { clearUserData } from 'shared/offline/clearUserData';
import { cachesByUser } from 'shared/offline/userCaches';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import type { ExpenseDraft, ExpensePatch } from '../model/types';

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
const onWriteFailed = vi.fn<LedgerWriteEffects['onWriteFailed']>();
const effects: LedgerWriteEffects = { onEntryWritten, onWriteFailed };

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

const usd = (units: bigint): Money => fromUnits(units, currencyCode('USD'));
const jpy = (units: bigint): Money => fromUnits(units, currencyCode('JPY'));

const expense: ExpenseDraft = {
    groupId: 'group-1',
    description: 'Dinner',
    amount: usd(855_000n),
    date: 1_717_200_000,
    payerId: 'user-1',
    participantIds: ['user-1', 'user-2'],
    category: 'food',
    sharingMode: { type: 'AUTO' },
};

// The create body text: every amount a decimal literal of scale 4 (`moneyToWire`), percents and
// weights their shortest decimal literal. The legacy client wrote the same values as doubles
// (`85.5`, `100.25`), so the server reads the same numbers.
const createText = (fields: string, groupId: string | null = 'group-1'): string =>
    `{"type":"EXPENSE",${groupId ? `"groupId":"${groupId}",` : ''}"expense":{${fields}}}`;

beforeEach(() => {
    vi.clearAllMocks();
    onEntryWritten.mockResolvedValue(undefined);
    onWriteFailed.mockResolvedValue(undefined);
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
    const fields = (amount: string, currency: string, category: string, sharingMode: string) =>
        `"description":"Dinner","amount":${amount},"date":1717200000,"payerId":"user-1",` +
        `"participantIds":["user-1","user-2"],"currency":"${currency}","category":${category},` +
        `"sharingMode":${sharingMode}`;

    test.each<[string, ExpenseDraft, string]>([
        [
            'an equal split in a group, 2 fraction digits',
            expense,
            createText(fields('85.5000', 'USD', '"food"', '{"type":"AUTO"}')),
        ],
        [
            'uneven exact amounts between friends',
            {
                ...expense,
                groupId: undefined,
                amount: usd(1_002_500n),
                category: null,
                sharingMode: {
                    type: 'EXACT',
                    customShares: { 'user-1': usd(602_000n), 'user-2': usd(400_500n) },
                },
            },
            createText(
                fields(
                    '100.2500',
                    'USD',
                    'null',
                    '{"type":"EXACT","customShares":{"user-1":60.2000,"user-2":40.0500}}',
                ),
                null,
            ),
        ],
        [
            'uneven exact amounts in a currency of 0 fraction digits',
            {
                ...expense,
                amount: jpy(10_000_000n),
                sharingMode: {
                    type: 'EXACT',
                    customShares: { 'user-1': jpy(3_340_000n), 'user-2': jpy(6_660_000n) },
                },
            },
            createText(
                fields(
                    '1000.0000',
                    'JPY',
                    '"food"',
                    '{"type":"EXACT","customShares":{"user-1":334.0000,"user-2":666.0000}}',
                ),
            ),
        ],
        [
            'percentages: their shortest literal',
            {
                ...expense,
                amount: usd(1_000n),
                sharingMode: {
                    type: 'PERCENTAGE',
                    percentageShares: { 'user-1': '33.50', 'user-2': '66.5' },
                },
            },
            createText(
                fields(
                    '0.1000',
                    'USD',
                    '"food"',
                    '{"type":"PERCENTAGE","percentageShares":{"user-1":33.5,"user-2":66.5}}',
                ),
            ),
        ],
        [
            'share weights',
            {
                ...expense,
                amount: usd(12_000_000n),
                sharingMode: { type: 'SHARES', shares: { 'user-1': '1', 'user-2': '2' } },
            },
            createText(
                fields(
                    '1200.0000',
                    'USD',
                    '"food"',
                    '{"type":"SHARES","shares":{"user-1":1,"user-2":2}}',
                ),
            ),
        ],
    ])(
        'sends the amounts as decimal literals of scale 4, without an id: %s',
        async (_name, draft, text) => {
            const sent = serveLedger();

            await create({ expense: draft });

            expect(sent).toEqual([{ method: 'POST', path: '/ledger/entries', text }]);
            expect(sent[0]?.text).not.toContain('"id"');
        },
    );

    test('a percent or weight that is not a plain decimal is rejected before any request', async () => {
        const sent = serveLedger();

        await expect(
            create({
                expense: {
                    ...expense,
                    sharingMode: { type: 'SHARES', shares: { 'user-1': '1e3' } },
                },
            }),
        ).rejects.toBeInstanceOf(MoneyWireError);
        await expect(
            create({
                expense: {
                    ...expense,
                    sharingMode: { type: 'PERCENTAGE', percentageShares: { 'user-1': 'NaN' } },
                },
            }),
        ).rejects.toBeInstanceOf(MoneyWireError);
        expect(sent).toEqual([]);
        expect(onEntryWritten).not.toHaveBeenCalled();
        expect(onWriteFailed).not.toHaveBeenCalled();
    });

    test('after a group expense the group and the open activity history are read again', async () => {
        serveLedger();

        await create({ expense, parentActivityId: 'activity-1' });

        expect(onEntryWritten.mock.calls).toEqual([
            [{ groupId: 'group-1', parentActivityId: 'activity-1' }, getDefaultTestQueryClient()],
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
            expect(onEntryWritten).toHaveBeenCalledWith(
                { groupId: undefined, parentActivityId: undefined },
                getDefaultTestQueryClient(),
            );
        });
        expect(isSettled).toBe(false);
        reload.resolve();
        await expect(write).resolves.toBeUndefined();
    });
});

describe('update an expense', () => {
    // Patches in the key order `buildExpenseUpdateParams` writes them: the split block last.
    const split = { amount: usd(920_000n), participantIds: ['user-1', 'user-2'] };
    const splitText = '"amount":92.0000,"participantIds":["user-1","user-2"]';

    test.each<[string, ExpensePatch, string]>([
        ['only the changed fields', { description: 'Lunch' }, '"description":"Lunch"'],
        [
            'an equal split',
            { description: null, currency: 'EUR', ...split, sharingMode: { type: 'AUTO' } },
            `"description":null,"currency":"EUR",${splitText},"sharingMode":{"type":"AUTO"}`,
        ],
        [
            'uneven exact amounts',
            {
                payerId: 'user-2',
                category: null,
                ...split,
                sharingMode: {
                    type: 'EXACT',
                    customShares: { 'user-1': usd(505_000n), 'user-2': usd(415_000n) },
                },
            },
            `"payerId":"user-2","category":null,${splitText},` +
                '"sharingMode":{"type":"EXACT","customShares":{"user-1":50.5000,"user-2":41.5000}}',
        ],
        [
            'an amount of 0 fraction digits',
            { amount: jpy(1_230_000n), participantIds: ['user-1'], sharingMode: { type: 'AUTO' } },
            '"amount":123.0000,"participantIds":["user-1"],"sharingMode":{"type":"AUTO"}',
        ],
        [
            'percentages',
            {
                ...split,
                sharingMode: {
                    type: 'PERCENTAGE',
                    percentageShares: { 'user-1': '33.5', 'user-2': '66.5' },
                },
            },
            `${splitText},"sharingMode":{"type":"PERCENTAGE","percentageShares":{"user-1":33.5,"user-2":66.5}}`,
        ],
        [
            'share weights',
            { ...split, sharingMode: { type: 'SHARES', shares: { 'user-1': '1', 'user-2': '2' } } },
            `${splitText},"sharingMode":{"type":"SHARES","shares":{"user-1":1,"user-2":2}}`,
        ],
    ])('sends the named fields, amounts of scale 4: %s', async (_name, entry, fields) => {
        const sent = serveLedger();

        await update({ entryId: 'entry-1', entry, groupId: 'group-1', parentActivityId: 'a-1' });

        expect(sent).toEqual([
            {
                method: 'PATCH',
                path: '/ledger/entries/entry-1',
                text: `{"type":"EXPENSE","expense":{${fields}}}`,
            },
        ]);
        expect(sent[0]?.text).not.toContain('"date"');
        expect(onEntryWritten.mock.calls).toEqual([
            [
                { groupId: 'group-1', parentActivityId: 'a-1', entryId: 'entry-1' },
                getDefaultTestQueryClient(),
            ],
        ]);
    });
});

describe('delete a ledger entry', () => {
    test('sends DELETE for the entry and reads its views again', async () => {
        const sent = serveLedger();

        await remove({ entryId: 'entry-1', parentActivityId: 'activity-1' });

        expect(sent).toEqual([{ method: 'DELETE', path: '/ledger/entries/entry-1', text: '' }]);
        expect(onEntryWritten.mock.calls).toEqual([
            [
                { groupId: undefined, parentActivityId: 'activity-1', entryId: 'entry-1' },
                getDefaultTestQueryClient(),
            ],
        ]);
    });
});

test.each<[string, () => Promise<void>]>([
    ['an update', () => update({ entryId: '', entry: {} })],
    ['a delete', () => remove({ entryId: '', groupId: 'group-1' })],
])('%s of an entry without a valid id is never sent and refreshes nothing', async (_name, send) => {
    const sent = serveLedger();

    await expect(send()).rejects.toBeInstanceOf(InvalidPathSegmentError);
    expect(sent).toEqual([]);
    expect(onEntryWritten).not.toHaveBeenCalled();
    expect(onWriteFailed).not.toHaveBeenCalled();
});

const patch: ExpensePatch = { description: 'Lunch' };

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
    // a write without an answer may be committed. The failure does not wait for that refresh.
    describe.each<[string, number | 'no-response']>([
        ['a 4xx answer', 404],
        ['a 5xx answer', 500],
        ['no response', 'no-response'],
    ])('%s', (_name, status) => {
        test.each(writes)('a %s fails and what may be stale is read again', async (kind, send) => {
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
            expect(onWriteFailed.mock.calls).toEqual([
                [
                    {
                        groupId: 'group-1',
                        parentActivityId: 'activity-1',
                        // `ledger.entry(id)` is read again too (§2.2); a create has no id yet.
                        ...(kind !== 'create' && { entryId: 'entry-1' }),
                    },
                    getDefaultTestQueryClient(),
                ],
            ]);
            expect(onEntryWritten).not.toHaveBeenCalled();
        });
    });

    // After a network drop the refresh is paused until the reconnect: the failure does not wait.
    test.each(writes)(
        'a failed %s rejects with its own error while its refresh never settles',
        async (_kind, send) => {
            serveLedger(409);
            onWriteFailed.mockReturnValueOnce(new Promise<void>(() => undefined));

            await expect(send()).rejects.toMatchObject({ status: 409 });
            expect(onWriteFailed).toHaveBeenCalledOnce();
        },
    );

    test('a refresh that fails after a failed write is not an unhandled rejection', async () => {
        serveLedger(409);
        // A plain function: a rejection returned by a `vi.fn` never surfaces as unhandled.
        const failingEffects: LedgerWriteEffects = {
            onEntryWritten,
            onWriteFailed: () => Promise.reject(new Error('reload failed')),
        };
        const unhandled: unknown[] = [];
        const onUnhandled = (reason: unknown): void => {
            unhandled.push(reason);
        };

        // The app tsconfig has no Node types: the test runner's `process`, typed as far as used.
        type RejectionEvents = Record<
            'on' | 'off',
            (event: 'unhandledRejection', listener: (reason: unknown) => void) => void
        >;
        const nodeProcess = (globalThis as unknown as { process: RejectionEvents }).process;

        nodeProcess.on('unhandledRejection', onUnhandled);
        try {
            await expect(
                run(deleteLedgerEntryMutationOptions(failingEffects), {
                    entryId: 'entry-1',
                    sessionVersion: getAuthSessionVersion(),
                }),
            ).rejects.toBeInstanceOf(ApiError);
            // Node reports an unhandled rejection after the microtasks, before the next macrotask.
            await new Promise(resolve => setTimeout(resolve, 0));
        } finally {
            nodeProcess.off('unhandledRejection', onUnhandled);
        }

        expect(unhandled).toEqual([]);
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
            expect(onWriteFailed).not.toHaveBeenCalled();
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
            expect(onWriteFailed).not.toHaveBeenCalled();
        },
    );
});
