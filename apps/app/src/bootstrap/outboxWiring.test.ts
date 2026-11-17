import { get, set } from 'idb-keyval';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createExpenseViaOutbox, ledgerOutboxMutationKeys } from 'entities/ledger';
import { currencyCode, fromUnits } from 'shared/money';
import { outboxGate } from 'shared/offline/outboxGate';
import { outboxOwner, outboxRestoreState, resetOutbox } from 'shared/offline/outboxStore';
import { bootstrapUserCache, clientFor } from 'shared/offline/restore';
import { setUserClientSetup } from 'shared/offline/userCaches';
import { fakeAccessToken } from 'test/fakeAccessToken';

import { recheckOutboxOwnerOnToken, startUserOutbox } from './outboxWiring';

import 'fake-indexeddb/auto';

vi.mock('idb-keyval', async importOriginal => {
    const actual = await importOriginal<typeof import('idb-keyval')>();

    return { ...actual, get: vi.fn(actual.get), set: vi.fn(actual.set) };
});

const outboxKeysTouched = (): string[] =>
    [...vi.mocked(get).mock.calls, ...vi.mocked(set).mock.calls]
        .map(([key]) => String(key))
        .filter(key => key.startsWith('chipin:outbox'));

beforeEach(() => {
    setUserClientSetup(startUserOutbox);
});

afterEach(() => {
    setUserClientSetup(null);
    resetOutbox();
    vi.unstubAllEnvs();
});

test('03-15b flag off (master behaviour): a new user client and a new token touch no outbox key and start nothing', async () => {
    const client = clientFor('wiring-off');

    await bootstrapUserCache('wiring-off');
    recheckOutboxOwnerOnToken(fakeAccessToken('wiring-off'));
    expect(
        createExpenseViaOutbox(client, {
            expense: {
                description: 'Dinner',
                amount: fromUnits(10_000n, currencyCode('USD')),
                date: 1_717_200_000,
                payerId: 'wiring-off',
                participantIds: ['wiring-off'],
                category: 'food',
                sharingMode: { type: 'AUTO' },
            },
        }),
    ).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(outboxKeysTouched()).toEqual([]);
    expect(outboxOwner()).toBeNull();
    expect(outboxGate.isClosed('auth')).toBe(false);
    expect(client.getMutationDefaults(ledgerOutboxMutationKeys.createExpense)).toEqual({});
});

test('03-15b flag on: the new client registers the outbox defaults, then restores; the owner token opens the gate', async () => {
    vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    const client = clientFor('wiring-on');

    await vi.waitFor(() => expect(outboxRestoreState('wiring-on')).toBe('ok'));
    expect(client.getMutationDefaults(ledgerOutboxMutationKeys.createExpense)).toMatchObject({
        networkMode: 'always',
        retry: false,
    });
    // Read only (an empty outbox is not written).
    expect(new Set(outboxKeysTouched())).toEqual(
        new Set(['chipin:outbox:wiring-on', 'chipin:outbox-failed:wiring-on']),
    );
    expect(
        vi.mocked(set).mock.calls.filter(([key]) => String(key).startsWith('chipin:outbox')),
    ).toEqual([]);
    // No access token yet: closed until the owner's token is announced.
    expect(outboxGate.isClosed('auth')).toBe(true);

    recheckOutboxOwnerOnToken(fakeAccessToken('someone-else'));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(outboxGate.isClosed('auth')).toBe(true);

    recheckOutboxOwnerOnToken(fakeAccessToken('wiring-on'));
    await vi.waitFor(() => expect(outboxGate.isClosed('auth')).toBe(false));
});
