import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { activityKeys } from 'entities/activity';
import { useAuthStore } from 'store/authStore';
import { domainPreview, legacyPreview } from 'test/activityFixtures';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import { useActivityHistory } from './useActivityHistory';

const server = setupMswServer();

// The wire JSON of a chain: its creation event and a later edit (the legacy fixtures are the same JSON).
const { parent, lastEvent: edit } = legacyPreview('activity-1', { seq: 2 });
const { lastEvent: olderEdit } = legacyPreview('activity-1', { seq: 3 });

// Answers the history of `activity-1` page by page (`nextCursor` 40, then null); records the cursors.
const serveHistory = (status = 200): (string | null)[] => {
    const cursors: (string | null)[] = [];

    server.use(
        http.get('*/users/self/activities/:parentActivityId/children', ({ request }) => {
            const cursor = new URL(request.url).searchParams.get('cursor');

            cursors.push(cursor);
            if (status !== 200) {
                return HttpResponse.json({ code: 'ACTIVITY.NOT_FOUND' }, { status });
            }
            return HttpResponse.json(
                cursor === null
                    ? { parent, items: [olderEdit], nextCursor: 40 }
                    : { parent, items: [edit], nextCursor: null },
            );
        }),
    );
    return cursors;
};

const signIn = () => {
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    return mountAsUserClient();
};

beforeEach(() => {
    onlineManager.setOnline(true);
});

afterEach(() => {
    onlineManager.setOnline(true);
    useAuthStore.setState({ status: 'unknown' });
});

test('reads the chain through api() as domain events and loads the next page by its cursor', async () => {
    signIn();
    const cursors = serveHistory();
    const { result } = renderHook(() => useActivityHistory('activity-1'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
        expect(result.current.parent?.id).toBe('activity-1');
    });
    expect(result.current.parent?.metadata).toMatchObject({
        amount: { minor: 100_000n, currency: 'USD' },
    });
    expect(result.current.events.map(event => event.id)).toEqual(['activity-1-3']);
    expect(result.current.hasMore).toBe(true);

    act(() => {
        result.current.loadMore();
    });
    await waitFor(() => {
        expect(result.current.events.map(event => event.id)).toEqual([
            'activity-1-3',
            'activity-1-2',
        ]);
    });
    expect(result.current.hasMore).toBe(false);
    expect(cursors).toEqual([null, '40']);
});

test('signed out nothing is requested and nothing is loading', async () => {
    const cursors = serveHistory();
    const { result } = renderHook(() => useActivityHistory('activity-1'));

    await new Promise(resolve => setTimeout(resolve, 20));
    expect(cursors).toEqual([]);
    expect(result.current).toMatchObject({ isLoading: false, isError: false, isOffline: false });
});

test('a chain that does not exist (404) is an error with nothing loading, and Retry reads it again', async () => {
    signIn();
    const cursors = serveHistory(404);
    const { result } = renderHook(() => useActivityHistory('activity-1'));

    await waitFor(() => {
        expect(result.current.isError).toBe(true);
    });
    expect(result.current).toMatchObject({ isLoading: false, isOffline: false, parent: undefined });

    act(() => {
        result.current.reload();
    });
    await waitFor(() => {
        expect(cursors).toHaveLength(2);
    });
});

test('offline with nothing cached the history waits for the network: offline, not an error', async () => {
    signIn();
    const cursors = serveHistory();

    onlineManager.setOnline(false);
    const { result } = renderHook(() => useActivityHistory('activity-1'));

    await waitFor(() => {
        expect(result.current.isOffline).toBe(true);
    });
    expect(result.current).toMatchObject({ isLoading: false, isError: false });
    expect(cursors).toEqual([]);

    act(() => {
        onlineManager.setOnline(true);
    });
    await waitFor(() => {
        expect(result.current.parent?.id).toBe('activity-1');
    });
});

// Spec 03 §6 row 5 (12c), as `groups.detail`: a 403/404 wins over cached data, other errors do not.
test.each([403, 404])(
    'a refetch denied with %i over a cached chain is an error and the cached events are not shown',
    async status => {
        const client = signIn();
        const cursors = serveHistory();
        const { result } = renderHook(() => useActivityHistory('activity-1'));

        await waitFor(() => {
            expect(result.current.parent?.id).toBe('activity-1');
        });
        serveHistory(status);
        await act(() =>
            client.invalidateQueries({ queryKey: activityKeys.children('activity-1') }),
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
        expect(result.current).toMatchObject({
            parent: undefined,
            events: [],
            hasMore: false,
            isLoading: false,
        });
        expect(cursors).toEqual([null]);
    },
);

test('a refetch failing with a 5xx over a cached chain keeps the cached events shown', async () => {
    const client = signIn();
    serveHistory();
    const { result } = renderHook(() => useActivityHistory('activity-1'));

    await waitFor(() => {
        expect(result.current.parent?.id).toBe('activity-1');
    });
    const failed = serveHistory(500);
    await act(() => client.invalidateQueries({ queryKey: activityKeys.children('activity-1') }));

    expect(failed).toEqual([null]);
    expect(result.current).toMatchObject({ isError: false, isLoading: false });
    expect(result.current.parent?.id).toBe('activity-1');
    expect(result.current.events.map(event => event.id)).toEqual(['activity-1-3']);
});

test('an unreadable later event is left out and flagged', async () => {
    signIn();
    const broken = { ...edit, metadata: { ...edit.metadata, currency: 'X' } };

    server.use(
        http.get('*/users/self/activities/:parentActivityId/children', () =>
            HttpResponse.json({ parent, items: [olderEdit, broken], nextCursor: null }),
        ),
    );
    const { result } = renderHook(() => useActivityHistory('activity-1'));

    await waitFor(() => {
        expect(result.current.parent?.id).toBe('activity-1');
    });
    expect(result.current.events.map(event => event.id)).toEqual(['activity-1-3']);
    expect(result.current.hasInvalidEvents).toBe(true);
});

test.each([
    ['expired', true],
    ['invalid', true],
    ['signed_out', false],
    ['missing', false],
] as const)(
    'AUTH-077: with reason %s the cached history is shown: %s, with no request',
    async (reason, isShown) => {
        const cursors = serveHistory();
        const client = mountAsUserClient();
        const { parent: cachedParent, lastEvent } = domainPreview('activity-1');
        client.setQueryData(activityKeys.children('activity-1'), {
            pages: [{ parent: cachedParent, items: [lastEvent], nextCursor: null }],
            pageParams: [null],
        });
        useAuthStore.setState({ status: 'unauthenticated', unauthReason: reason });

        const { result } = renderHook(() => useActivityHistory('activity-1'));

        expect(result.current.events.map(event => event.id)).toEqual(isShown ? [lastEvent.id] : []);
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(cursors).toEqual([]);
    },
);
