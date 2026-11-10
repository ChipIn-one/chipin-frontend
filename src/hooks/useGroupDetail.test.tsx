import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import type { Group as LegacyGroup, SelfUser } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { type GroupActivityData, groupsKeys } from 'entities/groups';
import { useAuthStore } from 'store/authStore';
import { domainPreview, legacyPreview, wirePreview } from 'test/activityFixtures';
import { toTestGroup } from 'test/groupFixtures';
import { seedGroupsList } from 'test/groupsList';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { seedSelfUser } from 'test/selfUserSeed';

import { useAddExpenseAvailability } from './useAddExpenseAvailability';
import { useGroupActivity, useGroupDetail } from './useGroupDetail';

const server = setupMswServer();

const owner = {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    firstName: 'Owner',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const member = { ...owner, id: 'user-2', email: 'member@example.com', displayName: 'Member' };

const selfUser = {
    id: owner.id,
    email: owner.email,
    displayName: owner.displayName,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    createdAt: 1,
    updatedAt: 1,
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
} satisfies SelfUser;

const group = {
    id: 'group-1',
    name: 'Trip',
    inviteToken: 'invite-token',
    description: null,
    creator: owner,
    members: [
        { user: owner, balancesByCurrency: {} },
        { user: member, balancesByCurrency: {} },
    ],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: { items: [legacyPreview('listed')], nextCursor: 3 },
} satisfies LegacyGroup;

// The same group as the queries cache it (domain).
const cachedGroup = toTestGroup(group);

const detailKey = groupsKeys.detail(group.id);
const activityKey = groupsKeys.activity(group.id);

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    seedSelfUser(selfUser);
    seedGroupsList([cachedGroup]);
});

test('a 403/404 refetch wins over the cached detail: no group, no Add Expense target', async () => {
    getDefaultTestQueryClient().setQueryData(detailKey, cachedGroup);
    server.use(
        http.get('*/groups/group-1', () =>
            HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 }),
        ),
    );
    const { result } = renderHook(() => ({
        detail: useGroupDetail(group.id),
        availability: useAddExpenseAvailability(`${ROUTES.GROUP}/${group.id}`),
    }));

    expect(result.current.detail.group).toEqual(cachedGroup);
    expect(result.current.availability.isVisible).toBe(true);

    await act(() => getDefaultTestQueryClient().refetchQueries({ queryKey: detailKey }));

    await waitFor(() => {
        expect(result.current.detail.isDenied).toBe(true);
    });
    expect(result.current.detail.group).toBeUndefined();
    expect(result.current.detail.hasDetail).toBe(false);
    expect(result.current.availability.isVisible).toBe(false);
});

test('a failed detail read without a denial keeps the listed group and its recent activity', async () => {
    server.use(http.get('*/groups/group-1', () => HttpResponse.json({}, { status: 500 })));
    const { result } = renderHook(() => {
        const detail = useGroupDetail(group.id);

        return {
            detail,
            activity: useGroupActivity(group.id, detail.hasDetail, detail.group?.recentActivities),
        };
    });

    await waitFor(() => {
        expect(result.current.detail.isLoading).toBe(false);
    });
    expect(result.current.detail.isDenied).toBe(false);
    expect(result.current.detail.hasDetail).toBe(false);
    expect(result.current.detail.group).toEqual(cachedGroup);
    expect(result.current.activity.items).toEqual([domainPreview('listed')]);
    expect(result.current.activity.hasMore).toBe(false);
});

test('a route without a group creates no detail query', () => {
    const { result } = renderHook(() => useGroupDetail(undefined));

    expect(result.current.group).toBeUndefined();
    expect(
        getDefaultTestQueryClient()
            .getQueryCache()
            .findAll({ queryKey: groupsKeys.all })
            .filter(query => query.queryKey[1] === 'detail'),
    ).toHaveLength(0);
});

test('a scroll trigger waits for a running refetch, then loads the next page', async () => {
    const cursors: (string | null)[] = [];
    let answerRefetch: (() => void) | undefined;
    server.use(
        http.get('*/groups/group-1/activity-previews', ({ request }) => {
            const cursor = new URL(request.url).searchParams.get('cursor');

            cursors.push(cursor);
            if (cursor === null) {
                return new Promise<Response>(resolve => {
                    answerRefetch = () => {
                        resolve(HttpResponse.json({ items: [wirePreview('p1')], nextCursor: 5 }));
                    };
                });
            }
            return HttpResponse.json({ items: [wirePreview('p2')], nextCursor: null });
        }),
    );
    getDefaultTestQueryClient().setQueryData<GroupActivityData>(activityKey, {
        pages: [{ items: [domainPreview('p1')], nextCursor: 5 }],
        pageParams: [null],
    });
    const { result } = renderHook(() => useGroupActivity(group.id, true));

    act(() => {
        void getDefaultTestQueryClient().refetchQueries({ queryKey: activityKey });
    });
    await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
    });
    expect(result.current.isNextPageLoading).toBe(false);

    act(() => {
        result.current.loadMore();
    });
    expect(cursors).toEqual([null]);

    act(() => {
        answerRefetch?.();
    });
    await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
    });

    act(() => {
        result.current.loadMore();
    });
    await waitFor(() => {
        expect(result.current.items).toEqual([domainPreview('p1'), domainPreview('p2')]);
    });
    expect(cursors).toEqual([null, '5']);
});

// The detail and activity handlers of one opened group; `requests` lists what was sent.
const serveGroup = (detail: LegacyGroup, requests: string[]): void => {
    server.use(
        http.get('*/groups/group-1', () => {
            requests.push('detail');
            return HttpResponse.json(detail);
        }),
        http.get('*/groups/group-1/activity-previews', ({ request }) => {
            requests.push(`activity:${String(new URL(request.url).searchParams.get('cursor'))}`);
            return HttpResponse.json({ items: [wirePreview('d2')], nextCursor: null });
        }),
    );
};

const renderGroupActivity = (options?: { wrapper: typeof StrictMode }) =>
    renderHook(() => {
        const read = useGroupDetail(group.id);

        return useGroupActivity(group.id, read.hasDetail, read.group?.recentActivities);
    }, options);

test.each([
    ['', undefined],
    [' (StrictMode)', { wrapper: StrictMode }],
])(
    'ACT-023 opening a group seeds its activity from the detail: one request, then the cursor%s',
    async (_mode, options) => {
        const requests: string[] = [];
        serveGroup(
            { ...group, recentActivities: { items: [legacyPreview('d1')], nextCursor: 9 } },
            requests,
        );
        const { result } = renderGroupActivity(options);

        await waitFor(() => {
            expect(result.current.hasMore).toBe(true);
        });
        expect(result.current.items).toEqual([domainPreview('d1')]);
        expect(requests).toEqual(['detail']);

        act(() => {
            result.current.loadMore();
        });
        await waitFor(() => {
            expect(result.current.items).toEqual([domainPreview('d1'), domainPreview('d2')]);
        });
        expect(requests).toEqual(['detail', 'activity:9']);
    },
);

test('a seed from an old cached detail is stale: the first activity page loads again', async () => {
    const requests: string[] = [];
    const detail = { ...group, recentActivities: { items: [legacyPreview('d1')], nextCursor: 9 } };
    serveGroup(detail, requests);
    getDefaultTestQueryClient().setQueryData(detailKey, toTestGroup(detail), {
        updatedAt: Date.now() - 600_000,
    });

    const { result } = renderGroupActivity();

    await waitFor(() => {
        expect(requests).toContain('activity:null');
    });
    await waitFor(() => {
        expect(result.current.items).toEqual([domainPreview('d2')]);
    });
});

test('a denied group neither seeds its activity nor shows the cached activity', async () => {
    const requests: string[] = [];
    server.use(
        http.get('*/groups/group-1', () => {
            requests.push('detail');
            return HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
        }),
        http.get('*/groups/group-1/activity-previews', () => {
            requests.push('activity');
            return HttpResponse.json({ items: [], nextCursor: null });
        }),
    );
    getDefaultTestQueryClient().setQueryData(detailKey, cachedGroup, { updatedAt: 0 });
    getDefaultTestQueryClient().setQueryData<GroupActivityData>(activityKey, {
        pages: [{ items: [domainPreview('cached')], nextCursor: null }],
        pageParams: [null],
    });
    const { result } = renderHook(() => {
        const read = useGroupDetail(group.id);

        return {
            read,
            activity: useGroupActivity(group.id, read.hasDetail, read.group?.recentActivities),
        };
    });

    await waitFor(() => {
        expect(result.current.read.isDenied).toBe(true);
    });
    expect(result.current.activity.items).toEqual([]);
    expect(result.current.activity.hasMore).toBe(false);
    expect(requests).not.toContain('activity');
});

test('a group denied on its first read seeds nothing and reads no activity', async () => {
    const requests: string[] = [];
    server.use(
        http.get('*/groups/group-1', () => {
            requests.push('detail');
            return HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
        }),
        http.get('*/groups/group-1/activity-previews', () => {
            requests.push('activity');
            return HttpResponse.json({ items: [], nextCursor: null });
        }),
    );
    const { result } = renderHook(() => {
        const read = useGroupDetail(group.id);

        return {
            read,
            activity: useGroupActivity(group.id, read.hasDetail, read.group?.recentActivities),
        };
    });

    await waitFor(() => {
        expect(result.current.read.isDenied).toBe(true);
    });
    expect(result.current.activity.items).toEqual([]);
    expect(getDefaultTestQueryClient().getQueryData(activityKey)).toBeUndefined();
    expect(requests).toEqual(['detail']);
});

test('the detail never replaces activity already cached', async () => {
    getDefaultTestQueryClient().setQueryData<GroupActivityData>(activityKey, {
        pages: [{ items: [domainPreview('cached')], nextCursor: null }],
        pageParams: [null],
    });
    getDefaultTestQueryClient().setQueryData(detailKey, cachedGroup);
    const { result } = renderHook(() =>
        useGroupActivity(group.id, true, cachedGroup.recentActivities),
    );

    await waitFor(() => {
        expect(result.current.items).toEqual([domainPreview('cached')]);
    });
});
