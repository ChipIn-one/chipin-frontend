import { MutationObserver, type MutationObserverOptions } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { CreateLedgerEntryParams, UpdateLedgerExpenseParams } from 'api/chipin.types';
import { getAuthSessionVersion, invalidateAuthSession } from 'helpers/authSession';
import { ApiError } from 'shared/api/client';
import { MoneyWireError } from 'shared/money';
import { setupMswServer } from 'test/mswServer';
import { createTestQueryClient } from 'test/renderWithQueryClient';

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
const serveLedger = (status = 200, gate?: Deferred): SentRequest[] => {
    const sent: SentRequest[] = [];
    const answer = async ({ request }: { request: Request }): Promise<Response> => {
        sent.push({
            method: request.method,
            path: new URL(request.url).pathname.replace(/^.*\/ledger/, '/ledger'),
            text: await request.text(),
        });
        await gate?.promise;
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

const run = <Variables>(
    options: MutationObserverOptions<void, Error, Variables>,
    variables: Variables,
): Promise<void> => new MutationObserver(createTestQueryClient(), options).mutate(variables);

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
    const entry: UpdateLedgerExpenseParams = {
        type: 'EXPENSE',
        expense: {
            description: 'Lunch',
            category: null,
            amount: 92,
            participantIds: ['user-1', 'user-2'],
            sharingMode: { type: 'EXACT', customShares: { 'user-1': 50.5, 'user-2': 41.5 } },
        },
    };

    test('sends the patch as the legacy client did and reads its views again', async () => {
        const sent = serveLedger();

        await update({ entryId: 'entry-1', entry, groupId: 'group-1', parentActivityId: 'a-1' });

        expect(sent.map(({ method, path }) => ({ method, path }))).toEqual([
            { method: 'PATCH', path: '/ledger/entries/entry-1' },
        ]);
        expect(JSON.parse(sent[0]?.text ?? '')).toEqual(entry);
        expect(onEntryWritten.mock.calls).toEqual([
            [{ groupId: 'group-1', parentActivityId: 'a-1' }],
        ]);
    });

    test('a patch without a split change carries only the changed fields', async () => {
        const sent = serveLedger();

        await update({
            entryId: 'entry-1',
            entry: { type: 'EXPENSE', expense: { description: 'Lunch' } },
        });

        expect(sent[0]?.text).toBe('{"type":"EXPENSE","expense":{"description":"Lunch"}}');
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

describe('a failed or outdated write', () => {
    test('a rejected request fails with ApiError (status and code) and reloads nothing', async () => {
        serveLedger(404);

        const failures = await Promise.all(
            [
                create({ expense }),
                update({ entryId: 'entry-1', entry: { type: 'EXPENSE', expense: {} } }),
                remove({ entryId: 'entry-1' }),
            ].map(write =>
                write.then(
                    () => null,
                    (error: unknown) => error,
                ),
            ),
        );

        failures.forEach(error => {
            expect(error).toBeInstanceOf(ApiError);
            expect(error).toMatchObject({ status: 404, code: 'LEDGER.ENTRY_NOT_FOUND' });
        });
        expect(onEntryWritten).not.toHaveBeenCalled();
    });

    test('a sign-out or an account switch during the request reloads nothing for the next user', async () => {
        const gate = deferred();
        const sent = serveLedger(200, gate);
        const writes = [
            create({ expense }),
            update({ entryId: 'entry-1', entry: { type: 'EXPENSE', expense: {} } }),
            remove({ entryId: 'entry-2' }),
        ];

        await vi.waitFor(() => {
            expect(sent).toHaveLength(3);
        });
        invalidateAuthSession();
        gate.resolve();
        await Promise.all(writes);

        expect(onEntryWritten).not.toHaveBeenCalled();
    });
});
