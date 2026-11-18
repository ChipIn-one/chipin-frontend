// Spec 03 §1.5 row `signOut()` (03-16a part C): the N of "N unsent operations will be deleted" is
// read from the stored outbox keys of the cached user: pending ops, failed and unreadable records.
import { clear, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    addKeptOutboxUser,
    clearLocalUserIdentity,
    removeKeptOutboxUsers,
    saveLocalUser,
} from 'helpers/localStorage';
import { outboxFailedKey, outboxStateKey } from 'shared/offline/constants';
import { persistCodec } from 'shared/offline/persistCodec';

import {
    isSignOutUserCurrent,
    isUnsentOpsConfirmOn,
    readSignOutOutboxCount,
} from './unsentOpsConfirm';

import 'fake-indexeddb/auto';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));

const USER = 'user-x';
const KEPT = 'user-kept';

const op = (seq: number) => ({
    opId: `op-${seq}`,
    seq,
    owner: USER,
    entryKind: 'expense',
    createdAt: Date.now(),
    schema: 1,
    kind: 'createExpense',
    entryId: `entry-${seq}`,
    groupId: null,
    parentActivityId: null,
    draft: {},
});

const storeOutbox = (pending: unknown[], failed: unknown[], userId = USER): Promise<void> =>
    Promise.all([
        set(
            outboxStateKey(userId),
            persistCodec.stringify({
                nextSeq: 10,
                ops: pending,
                versions: {},
                cancelled: [],
                retryRequested: [],
                sending: null,
                conflictDrafts: {},
            }),
        ),
        set(outboxFailedKey(userId), persistCodec.stringify(failed)),
    ]).then(() => undefined);

beforeEach(async () => {
    await clear();
    saveLocalUser({
        id: USER,
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
});

afterEach(() => {
    vi.unstubAllEnvs();
    clearLocalUserIdentity();
    removeKeptOutboxUsers([KEPT]);
});

describe('readSignOutOutboxCount', () => {
    test('pending ops + failed records + unreadable records (an op of a newer build)', async () => {
        await storeOutbox(
            [op(1), op(2), { opId: 'op-new', kind: 'futureKind' }],
            [{ op: op(3), reason: 'validation', failedAt: 1 }],
        );

        expect(await readSignOutOutboxCount()).toEqual({ userId: USER, count: 4 });
    });

    test('nothing stored: 0', async () => {
        expect(await readSignOutOutboxCount()).toEqual({ userId: USER, count: 0 });
    });

    test('a key unreadable as a whole: null (the confirm asks without a number)', async () => {
        await set(outboxStateKey(USER), 'not json');

        expect(await readSignOutOutboxCount()).toEqual({ userId: USER, count: null });
    });

    test('no cached user: 0', async () => {
        await storeOutbox([op(1)], []);
        clearLocalUserIdentity();

        expect(await readSignOutOutboxCount()).toEqual({ userId: undefined, count: 0 });
    });

    test('M3: the kept users are counted with the tab user', async () => {
        await storeOutbox([op(1)], []);
        await storeOutbox(
            [
                { ...op(1), owner: KEPT },
                { ...op(2), owner: KEPT },
            ],
            [],
            KEPT,
        );
        addKeptOutboxUser(KEPT);

        expect(await readSignOutOutboxCount()).toEqual({ userId: USER, count: 3 });
    });

    test('N2: the counted user is compared with the tab user', () => {
        expect(isSignOutUserCurrent(USER)).toBe(true);
        expect(isSignOutUserCurrent('someone-else')).toBe(false);
    });
});

test('asked only with offline writes on', () => {
    expect(isUnsentOpsConfirmOn()).toBe(false);
    vi.stubEnv('VITE_FEATURE_OFFLINE_WRITES', 'true');
    expect(isUnsentOpsConfirmOn()).toBe(true);
});
