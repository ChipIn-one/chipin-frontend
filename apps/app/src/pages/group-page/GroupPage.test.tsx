import { MutationObserver } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import type { Group } from 'api/chipin.types';
import { type GroupActivityData, groupsKeys, joinGroupMutationOptions } from 'entities/groups';
import { getAuthSessionVersion } from 'helpers/authSession';
import { clearLocalUserIdentity, resetTabUserId, saveLocalUser } from 'helpers/localStorage';
import type { GroupActivityResult } from 'hooks/useGroupDetail';
import { useAuthStore } from 'store/authStore';
import { useUiPrefsStore } from 'store/ui-prefs';
import { domainPreview, legacyPreview } from 'test/activityFixtures';
import { getOrThrow } from 'test/getOrThrow';
import { toTestGroup } from 'test/groupFixtures';
import { cachedGroupsList, seedGroupsList } from 'test/groupsList';
import { setupMswServer } from 'test/mswServer';
import { getDefaultTestQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import { GroupPage } from './GroupPage';

const server = setupMswServer();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const routeParams = vi.hoisted((): { groupId?: string } => ({ groupId: 'group-1' }));

vi.mock('react-router-dom', async importOriginal => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useParams: () => routeParams,
}));

vi.mock('components/GroupsCards', () => ({
    GroupsCards: ({ groups, selectedGroupId }: { groups: Group[]; selectedGroupId?: string }) => (
        <div
            data-testid="groups-cards"
            data-count={String(groups.length)}
            data-selected={selectedGroupId}
        />
    ),
}));

// The sections render what the page hands them: the page's own readers (the detail and activity
// queries) run for real, and so does the not-found state.
vi.mock('./components', async () => ({
    GroupCoverSection: ({ group, isLoading }: { group: Group | null; isLoading: boolean }) => (
        <div
            data-testid="group-cover-hero"
            data-name={group?.name}
            data-loading={String(isLoading)}
        />
    ),
    GroupNotFound: (
        await vi.importActual<typeof import('./components/GroupNotFound')>(
            './components/GroupNotFound',
        )
    ).GroupNotFound,
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

const TAB_USER_ID = 'tab-user';
const SETTINGS = {
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
} as const;

const renderPage = () =>
    render(
        <MemoryRouter>
            <GroupPage />
        </MemoryRouter>,
    );

const expectNotFound = async (): Promise<void> => {
    expect(
        await screen.findByRole('heading', { level: 1, name: 'group:page.notFoundTitle' }),
    ).not.toBeNull();
    expect(
        screen.getByRole('link', { name: 'common:buttons.goToDashboard' }).getAttribute('href'),
    ).toBe('/dashboard');
};

beforeEach(() => {
    routeParams.groupId = 'group-1';
    useAuthStore.setState({ status: 'authenticated' });
    useUiPrefsStore.getState().resetUiPrefs();
    seedGroupsList([group]);
});

test('renders the seeded group detail and its activity without a request', () => {
    seedDetail(detail);

    renderPage();

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

    renderPage();

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

test('GRP-017 shows the cover skeleton while an unlisted group loads for the first time', () => {
    getDefaultTestQueryClient().removeQueries({ queryKey: groupsKeys.list() });
    server.use(http.get('*/groups/group-1', () => new Promise<never>(() => undefined)));

    renderPage();

    expect(screen.getByTestId('group-cover-hero').dataset.loading).toBe('true');
    expect(screen.queryByTestId('group-tabs')).toBeNull();
    expect(screen.queryByText('group:page.notFoundTitle')).toBeNull();
});

test('GRP-017 shows the not-found state with a way to the dashboard when the route has no group id', async () => {
    routeParams.groupId = undefined;

    renderPage();

    await expectNotFound();
    expect(screen.queryByTestId('group-cover-hero')).toBeNull();
    expect(screen.queryByTestId('group-tabs')).toBeNull();
});

test.each([403, 404])(
    'GRP-011 GRP-017 shows the not-found state on a %i detail and reloads the list, which no longer has the group',
    async status => {
        useUiPrefsStore.getState().setLastGroupId(group.id);
        let listReads = 0;
        server.use(
            http.get('*/groups/group-1', () =>
                HttpResponse.json({ code: 'GROUP_NOT_FOUND' }, { status }),
            ),
            http.get('*/groups', () => {
                listReads += 1;
                return HttpResponse.json({ items: [], nextCursor: null });
            }),
        );

        renderPage();

        await expectNotFound();
        expect(screen.queryByTestId('group-tabs')).toBeNull();
        // #669: the denied read itself writes no other cache; the page reloads the list once.
        await waitFor(() => {
            expect(cachedGroupsList(getDefaultTestQueryClient())).toEqual([]);
        });
        expect(listReads).toBe(1);
        expect(useUiPrefsStore.getState().lastGroupId).toBeNull();
    },
);

test('never renders the detail of another group for the route group', async () => {
    getDefaultTestQueryClient().removeQueries({ queryKey: groupsKeys.list() });
    seedDetail({ ...detail, id: 'group-2' });
    server.use(http.get('*/groups/group-1', () => HttpResponse.json({}, { status: 404 })));

    renderPage();

    expect(await screen.findByText('group:page.notFoundTitle')).not.toBeNull();
    expect(screen.queryByTestId('group-tabs')).toBeNull();
});

test('a denial on a refetch replaces the shown group with the not-found state', async () => {
    seedDetail(detail);
    server.use(
        http.get('*/groups/group-1', () =>
            HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 }),
        ),
    );

    renderPage();
    expect(screen.getByTestId('group-tabs').dataset.name).toBe(detail.name);
    expect(useUiPrefsStore.getState().lastGroupId).toBe(group.id);

    await act(() =>
        getDefaultTestQueryClient().refetchQueries({ queryKey: groupsKeys.detail(group.id) }),
    );

    expect(await screen.findByText('group:page.notFoundTitle')).not.toBeNull();
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

    renderPage();

    await waitFor(() => {
        expect(screen.getByTestId('group-tabs').dataset.loading).toBe('false');
    });
    expect(screen.getByTestId('group-tabs').dataset.name).toBe(group.name);
    expect(screen.getByTestId('group-tabs').dataset.activity).toBe('listed');
    expect(screen.queryByText('group:page.notFoundTitle')).toBeNull();
});

test('a group just joined opens without a detail or activity request', async () => {
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
        http.post('*/groups/invite/:inviteToken', () => HttpResponse.json(detail)),
        http.get('*/groups', () => HttpResponse.json({ items: [detail], nextCursor: null })),
    );
    // This tab's user owns the default client: the join writes there.
    const client = mountAsUserClient(TAB_USER_ID);
    saveLocalUser({ id: TAB_USER_ID, settings: SETTINGS });
    try {
        // The join mutation, as the invite page sends it.
        await new MutationObserver(client, joinGroupMutationOptions()).mutate({
            inviteToken: detail.inviteToken,
            sessionVersion: getAuthSessionVersion(),
        });

        renderPage();

        expect(screen.getByTestId('group-tabs').dataset.name).toBe(detail.name);
        expect(screen.getByTestId('group-tabs').dataset.activity).toBe('p1');
        expect(screen.getByTestId('group-tabs').dataset.hasMore).toBe('true');
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(requests).toEqual([]);
    } finally {
        clearLocalUserIdentity();
        resetTabUserId();
    }
});
