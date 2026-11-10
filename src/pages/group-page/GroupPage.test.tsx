import { act, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import type { Group } from 'api/chipin.types';
import { type GroupActivityData, groupsKeys } from 'entities/groups';
import type { GroupActivityResult } from 'hooks/useGroupDetail';
import { useAuthStore } from 'store/authStore';
import { useUiPrefsStore } from 'store/ui-prefs';
import { domainPreview, legacyPreview } from 'test/activityFixtures';
import { getOrThrow } from 'test/getOrThrow';
import { toTestGroup } from 'test/groupFixtures';
import { cachedGroupsList, seedGroupsList } from 'test/groupsList';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';

import GroupPage from './GroupPage';

const server = setupMswServer();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
    useParams: () => ({ groupId: 'group-1' }),
}));

vi.mock('components/GroupsCards', () => ({
    default: ({ groups, selectedGroupId }: { groups: Group[]; selectedGroupId?: string }) => (
        <div
            data-testid="groups-cards"
            data-count={String(groups.length)}
            data-selected={selectedGroupId}
        />
    ),
}));

// The sections render what the page hands them: the page's own readers (the detail and activity
// queries) run for real.
vi.mock('./components', () => ({
    GroupCoverSection: ({ group }: { group: Group }) => (
        <div data-testid="group-cover-hero" data-name={group.name} />
    ),
    GroupSummary: (props: { group: Group }) => (
        <div
            data-testid="group-summary"
            data-name={props.group.name}
            data-has-layout={String('layout' in props)}
        />
    ),
    GroupTabsContent: ({
        group,
        isGroupDataLoading,
        activity,
    }: {
        group: Group;
        isGroupDataLoading: boolean;
        activity: GroupActivityResult;
    }) => (
        <div
            data-testid="group-tabs"
            data-group-id={group.id}
            data-name={group.name}
            data-loading={String(isGroupDataLoading)}
            data-activity={activity.items.map(item => item.parent.id).join(',')}
            data-has-more={String(activity.hasMore)}
        />
    ),
}));

const creator = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    firstName: 'Alice',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const group = {
    id: 'group-1',
    name: 'Vietnam',
    inviteToken: 'invite-token',
    description: null,
    creator,
    members: [{ user: creator, balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: 'https://cdn.example.com/group.webp',
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: {
        items: [],
        nextCursor: null,
    },
} satisfies Group;

const preview = (parentId: string) => legacyPreview(parentId);

const detail = {
    ...group,
    name: 'Vietnam detail',
    recentActivities: { items: [preview('p1')], nextCursor: 5 },
} satisfies Group;

const seedDetail = (seeded: Group): void => {
    const client = getDefaultTestQueryClient();

    client.setQueryData(groupsKeys.detail(seeded.id), toTestGroup(seeded));
    client.setQueryData<GroupActivityData>(groupsKeys.activity(seeded.id), {
        pages: [
            {
                items: seeded.recentActivities.items.map(item => domainPreview(item.parent.id)),
                nextCursor: seeded.recentActivities.nextCursor,
            },
        ],
        pageParams: [null],
    });
};

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useUiPrefsStore.getState().resetUiPrefs();
    seedGroupsList([group]);
});

test('renders the seeded group detail and its activity without a request', () => {
    seedDetail(detail);

    render(<GroupPage />);

    const summaries = screen.getAllByTestId('group-summary');
    const tabs = screen.getByTestId('group-tabs');

    expect(summaries).toHaveLength(2);
    summaries.forEach(summary => {
        expect(summary.dataset.name).toBe(detail.name);
        expect(summary.dataset.hasLayout).toBe('false');
    });
    expect(
        getOrThrow(summaries, 1).compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByTestId('group-cover-hero').dataset.name).toBe(detail.name);
    expect(tabs.dataset.name).toBe(detail.name);
    expect(tabs.dataset.loading).toBe('false');
    expect(tabs.dataset.activity).toBe('p1');
    expect(tabs.dataset.hasMore).toBe('true');
    expect(screen.getByTestId('groups-cards').dataset.selected).toBe(group.id);
    expect(useUiPrefsStore.getState().lastGroupId).toBe(group.id);
});

test('shows the listed group while its detail loads, then the detail and its first activity page', async () => {
    const requests: string[] = [];
    server.use(
        http.get('*/groups/group-1', () => {
            requests.push('detail');
            return HttpResponse.json(detail);
        }),
        http.get('*/groups/group-1/activity-previews', () => {
            requests.push('activity');
            return HttpResponse.json({ items: [], nextCursor: null });
        }),
    );

    render(<GroupPage />);

    expect(screen.getByTestId('group-tabs').dataset.name).toBe(group.name);
    expect(screen.getByTestId('group-tabs').dataset.loading).toBe('true');

    await waitFor(() => {
        expect(screen.getByTestId('group-tabs').dataset.name).toBe(detail.name);
    });
    expect(screen.getByTestId('group-tabs').dataset.loading).toBe('false');
    expect(screen.getByTestId('group-tabs').dataset.activity).toBe('p1');
    // The detail seeds the first activity page: opening a group sends one request.
    expect(requests).toEqual(['detail']);
});

test('renders nothing while an unlisted group loads for the first time', () => {
    getDefaultTestQueryClient().removeQueries({ queryKey: groupsKeys.list() });
    server.use(http.get('*/groups/group-1', () => new Promise<never>(() => undefined)));

    render(<GroupPage />);

    expect(screen.queryByTestId('group-tabs')).toBeNull();
    expect(screen.queryByText('group:page.notFound')).toBeNull();
});

test.each([403, 404])(
    'shows the not-found card on a %i detail and drops the group from the list',
    async status => {
        useUiPrefsStore.getState().setLastGroupId(group.id);
        server.use(
            http.get('*/groups/group-1', () =>
                HttpResponse.json({ code: 'GROUP_NOT_FOUND' }, { status }),
            ),
        );

        render(<GroupPage />);

        expect(await screen.findByText('group:page.notFound')).not.toBeNull();
        expect(screen.queryByTestId('group-tabs')).toBeNull();
        expect(cachedGroupsList(getDefaultTestQueryClient())).toEqual([]);
        expect(useUiPrefsStore.getState().lastGroupId).toBeNull();
    },
);

test('never renders the detail of another group for the route group', async () => {
    getDefaultTestQueryClient().removeQueries({ queryKey: groupsKeys.list() });
    seedDetail({ ...detail, id: 'group-2' });
    server.use(http.get('*/groups/group-1', () => HttpResponse.json({}, { status: 404 })));

    render(<GroupPage />);

    expect(await screen.findByText('group:page.notFound')).not.toBeNull();
    expect(screen.queryByTestId('group-tabs')).toBeNull();
});

test('a denial on a refetch replaces the shown group with the not-found card', async () => {
    seedDetail(detail);
    server.use(
        http.get('*/groups/group-1', () =>
            HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 }),
        ),
    );

    render(<GroupPage />);
    expect(screen.getByTestId('group-tabs').dataset.name).toBe(detail.name);
    expect(useUiPrefsStore.getState().lastGroupId).toBe(group.id);

    await act(() =>
        getDefaultTestQueryClient().refetchQueries({ queryKey: groupsKeys.detail(group.id) }),
    );

    expect(await screen.findByText('group:page.notFound')).not.toBeNull();
    expect(screen.queryByTestId('group-tabs')).toBeNull();
    expect(useUiPrefsStore.getState().lastGroupId).toBeNull();
});

test('a failed detail read keeps showing the listed group and its recent activity', async () => {
    const listedWithActivity = {
        ...group,
        recentActivities: { items: [preview('listed')], nextCursor: 4 },
    } satisfies Group;
    seedGroupsList([toTestGroup(listedWithActivity)]);
    server.use(http.get('*/groups/group-1', () => HttpResponse.json({}, { status: 500 })));

    render(<GroupPage />);

    await waitFor(() => {
        expect(screen.getByTestId('group-tabs').dataset.loading).toBe('false');
    });
    expect(screen.getByTestId('group-tabs').dataset.name).toBe(group.name);
    expect(screen.getByTestId('group-tabs').dataset.activity).toBe('listed');
    expect(screen.queryByText('group:page.notFound')).toBeNull();
});
