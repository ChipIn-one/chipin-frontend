import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import type { ActivityFeedItem, Group, SelfUser } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { type GroupActivityData, groupsKeys } from 'entities/groups';
import { useAuthStore } from 'store/authStore';
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

const preview = (parentId: string): ActivityFeedItem =>
    ({
        parent: { id: parentId },
        lastEvent: { id: `${parentId}-1`, seq: 1 },
    }) as unknown as ActivityFeedItem;

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
    recentActivities: { items: [preview('listed')], nextCursor: 3 },
} satisfies Group;

const detailKey = groupsKeys.detail(group.id);
const activityKey = groupsKeys.activity(group.id);

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    seedSelfUser(selfUser);
    seedGroupsList([group]);
});

test('a 403/404 refetch wins over the cached detail: no group, no Add Expense target', async () => {
    getDefaultTestQueryClient().setQueryData(detailKey, group);
    server.use(
        http.get('*/groups/group-1', () =>
            HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 }),
        ),
    );
    const { result } = renderHook(() => ({
        detail: useGroupDetail(group.id),
        availability: useAddExpenseAvailability(`${ROUTES.GROUP}/${group.id}`),
    }));

    expect(result.current.detail.group).toEqual(group);
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
    expect(result.current.detail.group).toEqual(group);
    expect(result.current.activity.items).toEqual([preview('listed')]);
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
                        resolve(HttpResponse.json({ items: [preview('p1')], nextCursor: 5 }));
                    };
                });
            }
            return HttpResponse.json({ items: [preview('p2')], nextCursor: null });
        }),
    );
    getDefaultTestQueryClient().setQueryData<GroupActivityData>(activityKey, {
        pages: [{ items: [preview('p1')], nextCursor: 5 }],
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
        expect(result.current.items).toEqual([preview('p1'), preview('p2')]);
    });
    expect(cursors).toEqual([null, '5']);
});
