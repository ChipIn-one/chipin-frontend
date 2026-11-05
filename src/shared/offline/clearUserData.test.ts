import * as Sentry from '@sentry/react';
import { del, get, set } from 'idb-keyval';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { clearUserData } from './clearUserData';
import { outboxKeys, queryCacheKey } from './constants';
import { bootstrapUserCache, clientFor } from './restore';
import { cachesByUser } from './userCaches';

import 'fake-indexeddb/auto';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));
vi.mock('idb-keyval', async importOriginal => {
    const actual = await importOriginal<typeof import('idb-keyval')>();

    return { ...actual, get: vi.fn(actual.get), del: vi.fn(actual.del) };
});

const GROUPS_KEY = ['groups', 'list'];
// Longer than the persister throttle (1 s).
const THROTTLE_WINDOW_MS = 1300;

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const userKeys = (userId: string): string[] => [queryCacheKey(userId), ...outboxKeys(userId)];

const seedKeys = (userId: string): Promise<void> =>
    Promise.all(userKeys(userId).map(key => set(key, `stored ${key}`))).then(() => undefined);

const storedValues = (userId: string): Promise<unknown[]> =>
    Promise.all(userKeys(userId).map(key => get(key)));

beforeEach(() => {
    vi.mocked(Sentry.captureMessage).mockClear();
    vi.mocked(del).mockClear();
});

describe('clearUserData (spec 03 §1.5)', () => {
    test('deletes the query cache key and the three outbox keys of that user only', async () => {
        await seedKeys('clear-x');
        await seedKeys('clear-other');

        await clearUserData('clear-x', () => undefined);

        expect(await storedValues('clear-x')).toEqual([undefined, undefined, undefined, undefined]);
        expect(await storedValues('clear-other')).toEqual(
            userKeys('clear-other').map(key => `stored ${key}`),
        );
        expect(userKeys('clear-x')).toEqual([
            'chipin:rq:clear-x',
            'chipin:outbox:clear-x',
            'chipin:outbox-failed:clear-x',
            'chipin:outbox-inbox:clear-x',
        ]);
    });

    test('in order: unsubscribe, clear the client, reset the stores, del, forget the client', async () => {
        await bootstrapUserCache('order');
        const entry = cachesByUser.get('order');
        const steps: string[] = [];
        if (!entry?.unsubscribe) {
            throw new Error('expected a subscribed cache');
        }
        const { unsubscribe } = entry;
        entry.unsubscribe = () => {
            steps.push('unsubscribe');
            unsubscribe();
        };
        const client = clientFor('order');
        client.setQueryData(GROUPS_KEY, ['g1']);
        vi.spyOn(client, 'clear').mockImplementation(() => {
            steps.push(`clear:${client.getQueryCache().getAll().length}`);
        });
        vi.mocked(del).mockImplementation(key => {
            steps.push(`del:${String(key)}`);
            return Promise.resolve();
        });

        const cleared = clearUserData('order', () => {
            steps.push('resetUserStores');
        });
        // Step 4 is synchronous: the next sign-in of the user gets a new client.
        expect(cachesByUser.has('order')).toBe(false);
        await cleared;
        vi.mocked(del).mockRestore();

        expect(steps).toEqual([
            'unsubscribe',
            'clear:1',
            'resetUserStores',
            ...userKeys('order').map(key => `del:${key}`),
        ]);
        expect(clientFor('order')).not.toBe(client);
    });

    test('a throttled persist and a cache event after the clear write nothing', async () => {
        await bootstrapUserCache('late-write');
        const client = clientFor('late-write');
        // Schedules a throttled write (1 s) with the data in it.
        client.setQueryData(GROUPS_KEY, ['private']);

        await clearUserData('late-write', () => undefined);
        client.setQueryData(GROUPS_KEY, ['after-logout']);
        await wait(THROTTLE_WINDOW_MS);

        expect(await get(queryCacheKey('late-write'))).toBeUndefined();
    });

    test('a restore that settles after the clear does not subscribe', async () => {
        let release: (value: undefined) => void = () => undefined;
        vi.mocked(get).mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    release = resolve;
                }),
        );
        const ready = bootstrapUserCache('restoring');
        const client = clientFor('restoring');

        await clearUserData('restoring', () => undefined);
        release(undefined);
        await ready;
        client.setQueryData(GROUPS_KEY, ['late']);
        await wait(THROTTLE_WINDOW_MS);

        expect(await get(queryCacheKey('restoring'))).toBeUndefined();
    });

    test('the same user signed in again: the new cache is saved', async () => {
        await bootstrapUserCache('again');
        await clearUserData('again', () => undefined);

        await bootstrapUserCache('again');
        clientFor('again').setQueryData(GROUPS_KEY, ['new-session']);

        await vi.waitFor(async () => {
            expect(await get<string>(queryCacheKey('again'))).toContain('new-session');
        }, 3000);
    });

    test('an IndexedDB error never rejects: reported, the stores are still reset', async () => {
        vi.mocked(del).mockRejectedValueOnce(new DOMException('gone', 'UnknownError'));
        const resetUserStores = vi.fn();

        await expect(clearUserData('idb-error', resetUserStores)).resolves.toBeUndefined();

        expect(resetUserStores).toHaveBeenCalledOnce();
        expect(Sentry.captureMessage).toHaveBeenCalledWith('offline.persist_failed', {
            level: 'warning',
            tags: { 'offline.error': 'UnknownError' },
        });
    });
});
