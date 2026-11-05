import * as Sentry from '@sentry/react';
import { dehydrate, QueryClient } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { persistCodec } from './persistCodec';
import { QUERY_CACHE_BUSTER, queryCacheKey } from './queryPersister';
import {
    bootstrapUserCache,
    clientFor,
    RESTORE_TIMEOUT_MS,
    restoreReady,
    startCacheRestore,
} from './restore';

import 'fake-indexeddb/auto';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));
vi.mock('idb-keyval', async importOriginal => {
    const actual = await importOriginal<typeof import('idb-keyval')>();

    return { ...actual, get: vi.fn(actual.get) };
});

// Test keys (the entity key factories do not exist yet).
const DASHBOARD_KEY = ['dashboard'];
const GROUPS_KEY = ['groups', 'list'];

/** Stores a valid persisted cache with one `DASHBOARD_KEY` entry; returns the stored text. */
const storeCache = (userId: string): Promise<string> => {
    const source = new QueryClient();
    source.setQueryData(DASHBOARD_KEY, { total: 5n });
    const text = persistCodec.stringify({
        timestamp: Date.now(),
        buster: QUERY_CACHE_BUSTER,
        clientState: dehydrate(source),
    });

    return set(queryCacheKey(userId), text).then(() => text);
};

const settleIdb = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 30));

beforeEach(() => {
    vi.mocked(Sentry.captureMessage).mockClear();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('bootstrapUserCache', () => {
    test('restores the user cache into that user client (bigint intact)', async () => {
        await storeCache('restore-ok');

        await bootstrapUserCache('restore-ok');

        expect(clientFor('restore-ok').getQueryData(DASHBOARD_KEY)).toEqual({ total: 5n });
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    test('one client per user, memoized; two users never share one', () => {
        expect(clientFor('memo-a')).toBe(clientFor('memo-a'));
        expect(clientFor('memo-a')).not.toBe(clientFor('memo-b'));
    });

    test('after the restore, cache changes are saved for that user', async () => {
        await bootstrapUserCache('subscribe');

        clientFor('subscribe').setQueryData(GROUPS_KEY, ['g1']);

        await vi.waitFor(async () => {
            const stored = await get<string>(queryCacheKey('subscribe'));
            expect(stored).toContain('g1');
            // The persister is throttled to one write per second.
        }, 3000);
    });

    test('a restore longer than 3 s: starts empty, the late result is not applied', async () => {
        const text = await storeCache('slow');
        const pending: { release: (value: string) => void } = { release: () => undefined };
        vi.mocked(get).mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    pending.release = resolve;
                }),
        );
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

        const ready = bootstrapUserCache('slow');
        await vi.advanceTimersByTimeAsync(RESTORE_TIMEOUT_MS);
        await ready;
        vi.useRealTimers();

        expect(Sentry.captureMessage).toHaveBeenCalledWith('offline.restore_timeout', {
            level: 'warning',
        });
        expect(clientFor('slow').getQueryData(DASHBOARD_KEY)).toBeUndefined();

        pending.release(text);
        await settleIdb();

        expect(clientFor('slow').getQueryData(DASHBOARD_KEY)).toBeUndefined();
    });

    test('an IDB read error resolves (never rejects), reports and drops the key', async () => {
        await storeCache('broken');
        vi.mocked(get).mockRejectedValueOnce(new DOMException('gone', 'UnknownError'));

        await expect(bootstrapUserCache('broken')).resolves.toBeUndefined();

        expect(Sentry.captureMessage).toHaveBeenCalledWith('offline.persist_failed', {
            level: 'warning',
            tags: { 'offline.error': 'UnknownError' },
        });
        expect(await get(queryCacheKey('broken'))).toBeUndefined();
    });

    test('malformed stored text resolves with an empty cache', async () => {
        await set(queryCacheKey('malformed'), '{"timestamp":"x"}');

        await expect(bootstrapUserCache('malformed')).resolves.toBeUndefined();

        expect(clientFor('malformed').getQueryData(DASHBOARD_KEY)).toBeUndefined();
        expect(await get(queryCacheKey('malformed'))).toBeUndefined();
    });
});

describe('restoreReady', () => {
    test('resolves at startup without a user (nothing to restore)', async () => {
        startCacheRestore(undefined);

        await expect(restoreReady).resolves.toBeUndefined();
    });
});
