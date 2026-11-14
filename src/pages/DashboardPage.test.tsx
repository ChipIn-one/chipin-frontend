import { Theme } from '@radix-ui/themes';
import type { QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import type { ActivityPreview } from 'entities/activity';
import { activityKeys } from 'entities/activity';
import { currencyRatesKeys, EMPTY_CURRENCY_RATES } from 'entities/currency-rates';
import { dashboardKeys } from 'entities/dashboard';
import type { Group } from 'entities/groups';
import { groupsKeys, groupsListQueryOptions } from 'entities/groups';
import { type KnownUser, knownUsersQueryOptions, usersKeys } from 'entities/users';
import { useAuthStore } from 'store/authStore';
import { useErrorsStore } from 'store/errorsStore';
import { useLoadingStore } from 'store/loadingStore';
import { domainPreview, wirePreview } from 'test/activityFixtures';
import { groupBalances } from 'test/groupFixtures';
import { groupsListData } from 'test/groupsList';
import { createKnownUser } from 'test/knownUsers';
import { setupMswServer } from 'test/mswServer';
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import DashboardPage from './DashboardPage';

const useInfiniteScrollMock = vi.hoisted(() =>
    vi.fn<typeof import('hooks/useInfiniteScroll').useInfiniteScroll>(() => vi.fn()),
);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('hooks/useInfiniteScroll', () => ({
    useInfiniteScroll: useInfiniteScrollMock,
}));

vi.mock('components/dashboard-onboarding', () => ({
    DashboardOnboarding: () => <div data-testid="dashboard-onboarding" />,
}));

vi.mock('components/dashboard-summary', () => ({
    DashboardHeader: () => <div data-testid="dashboard-header" />,
    DashboardSummary: ({ hasExpenseHistory }: { hasExpenseHistory: boolean }) =>
        hasExpenseHistory ? <div data-testid="dashboard-summary" /> : null,
}));

// The PWA store reads the display mode when its module loads (jsdom has no `matchMedia`); the
// real group cards below load it.
vi.hoisted(() => {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }),
    });
});

// A stand-in for the group cards, or the real ones for a test that sets `real`.
const groupsCardsMode = vi.hoisted(() => ({ real: false }));

vi.mock('components/GroupsCards', async importOriginal => {
    const { default: RealGroupsCards } =
        await importOriginal<typeof import('components/GroupsCards')>();

    return {
        default: (props: { groups: Group[]; label: string }) =>
            groupsCardsMode.real ? (
                <RealGroupsCards {...props} />
            ) : (
                <div data-testid="groups-cards" data-count={props.groups.length} />
            ),
    };
});

vi.mock('components/modals', () => ({
    CreateUpdateGroupModal: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('components/internal-page-layout', () => ({
    InternalPageColumnsFromSm: ({
        children,
        sidePanel,
    }: {
        children: React.ReactNode;
        sidePanel: React.ReactNode;
    }) => (
        <div data-testid="dashboard-columns">
            <main data-testid="dashboard-main">{children}</main>
            <aside data-testid="dashboard-side-panel">{sidePanel}</aside>
        </div>
    ),
}));

vi.mock('components/modals/create-update-group-modal', () => ({
    CreateUpdateGroupModal: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('components/skeletons', () => ({
    ActivityFeedSkeleton: () => <div data-testid="activity-skeleton" />,
}));

vi.mock('features/activity', () => ({
    ActivityEventsList: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="activity-list">{children}</div>
    ),
}));

const creator = {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    firstName: 'Owner',
    lastName: null,
    picture: null,
    createdAt: 1,
    updatedAt: 1,
};

const currentUser = {
    id: creator.id,
    email: creator.email,
    displayName: creator.displayName,
    picture: creator.picture,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'self-invite',
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
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

const singleMemberGroup = {
    id: 'group-1',
    name: 'Group',
    inviteToken: 'invite-token',
    description: null,
    creator,
    members: [
        {
            user: creator,
            balancesByCurrency: {},
        },
    ],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: {
        items: [],
        nextCursor: null,
    },
} satisfies Group;

const activityItem = domainPreview('activity-1');
const FEED_KEY = activityKeys.self({ view: 'previews' });

const server = setupMswServer();
let client: QueryClient;

const BALANCES_URL = '*/dashboard/balances';
const ACTIVITY_URL = '*/users/self/activity-previews';
const RATES_URL = '*/currency-rates';
const KNOWN_USERS_URL = '*/users/known-users';
const SELF_URL = '*/users/self';
const GROUPS_URL = '*/groups';
const badRequest = () =>
    HttpResponse.json({ code: 'SYSTEM.BAD_REQUEST', message: 'Unavailable' }, { status: 400 });

/** Answers `url` with `respond` and counts its requests. */
const countRequests = (url: string, respond: () => Response | Promise<Response>) => {
    const requests: URL[] = [];

    server.use(
        http.get(url, ({ request }) => {
            requests.push(new URL(request.url));
            return respond();
        }),
    );
    return requests;
};

/** The dashboard queries as a restored cache or a finished load leaves them: fresh, no request. */
const seedDashboard = ({
    items = [],
    nextCursor = null,
}: { items?: ActivityPreview[]; nextCursor?: number | null } = {}) => {
    client.setQueryData(dashboardKeys.balances(), []);
    client.setQueryData(FEED_KEY, {
        pages: [{ items, nextCursor }],
        pageParams: [null],
    });
};

const seedRates = () => {
    client.setQueryData(currencyRatesKeys.all, EMPTY_CURRENCY_RATES);
};

const seedFriends = (friends: KnownUser[] = []) => {
    client.setQueryData(usersKeys.known(), friends);
};

// A load of the known users that fails (a 500): with seeded friends it is a failed refresh.
const failFriendsLoad = async () => {
    countRequests(KNOWN_USERS_URL, badRequest);
    await client.prefetchQuery({ ...knownUsersQueryOptions(), staleTime: 0 });
};

// The groups list as a restored cache or a finished load leaves it: fresh, no request.
const seedGroups = (groups: Group[] = []) => {
    client.setQueryData(groupsKeys.list(), groupsListData(groups));
};

// A load of the groups list that fails (a 400): with seeded groups it is a failed refresh.
const failGroupsLoad = async () => {
    countRequests(GROUPS_URL, badRequest);
    await client.prefetchInfiniteQuery({ ...groupsListQueryOptions(), staleTime: 0 });
};

const friend = (lastUsedCurrency: string | null = null) =>
    createKnownUser('friend-1', [], { lastUsedCurrency });

const resolveDashboardOnboardingData = () => {
    seedDashboard();
    seedRates();
    seedFriends();
    seedGroups();
};

const renderPage = () => renderWithQueryClient(<DashboardPage />, client);

beforeEach(() => {
    vi.clearAllMocks();
    groupsCardsMode.real = false;
    client = createTestQueryClient();
    mountAsUserClient('user-1', client);
    useAuthStore.setState({ status: 'authenticated' });
    client.setQueryData(usersKeys.self(), currentUser);
    useLoadingStore.getState().setInitialLoadingStore();
    useErrorsStore.getState().resetErrors();
});

test('DSH-007 renders welcome only for no friends and no groups', () => {
    resolveDashboardOnboardingData();
    renderPage();

    const main = screen.getByTestId('dashboard-main');
    expect(within(main).getByTestId('dashboard-onboarding')).toBeTruthy();
    expect(within(main).queryByTestId('activity-list')).toBeNull();
});

test('DSH-011 hides the redundant No groups empty state on mobile Welcome, not desktop', () => {
    resolveDashboardOnboardingData();

    renderPage();

    const groupsSection = screen.getByTestId('dashboard-groups-section');
    const sidePanel = screen.getByTestId('dashboard-side-panel');
    expect(within(sidePanel).getByText('groups.emptyTitle')).toBeTruthy();
    expect(groupsSection.className).toContain('rt-r-display-none');
    expect(groupsSection.className).toContain('sm:rt-r-display-flex');
    expect(screen.getByTestId('dashboard-onboarding')).toBeTruthy();
});

test('DSH-011 keeps No groups visible on mobile once a friend exists', () => {
    resolveDashboardOnboardingData();
    seedFriends([friend()]);

    renderPage();

    const groupsSection = screen.getByTestId('dashboard-groups-section');
    expect(groupsSection.className).not.toContain('rt-r-display-none');
    expect(screen.getByText('groups.emptyTitle')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-onboarding')).toBeNull();
});

test('DSH-013 puts the Create group action below No groups yet at full width', () => {
    resolveDashboardOnboardingData();
    seedFriends([friend()]);

    renderPage();

    const side = screen.getByTestId('dashboard-side-panel');
    const label = within(side).getByText('groups.emptyTitle');
    const card = label.closest('[data-empty-state]');
    const action = within(side).getByRole('button', { name: 'common:buttons.createGroup' });

    expect(card?.querySelector('[data-empty-state-action]')?.contains(action)).toBe(true);
    expect(card?.firstElementChild?.className).toContain('rt-r-fd-column');
    expect(window.getComputedStyle(action).width).toBe('100%');
});

test('DSH-012 does not reserve vertical space when the Dashboard summary is empty', () => {
    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);

    renderPage();

    const side = screen.getByTestId('dashboard-side-panel');
    const groups = within(side).getByTestId('groups-cards');
    const panelLayout = side.firstElementChild;

    expect(panelLayout?.children).toHaveLength(2);
    expect(panelLayout?.lastElementChild?.contains(groups)).toBe(true);
});

test('DSH-012 shows settled summary after direct-friend expense history', () => {
    resolveDashboardOnboardingData();
    seedFriends([friend('USD')]);

    renderPage();

    expect(screen.getByTestId('dashboard-summary')).toBeTruthy();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
});

test('DSH-012 hides settled summary without direct-friend or group history', () => {
    resolveDashboardOnboardingData();
    seedFriends([friend()]);

    renderPage();

    expect(screen.queryByTestId('dashboard-summary')).toBeNull();
});

test('DSH-009 renders normal Dashboard for a one-member group with empty activity', () => {
    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);
    renderPage();

    const main = screen.getByTestId('dashboard-main');
    const sidePanel = screen.getByTestId('dashboard-side-panel');
    expect(within(main).queryByTestId('dashboard-onboarding')).toBeNull();
    expect(within(main).getByTestId('activity-list')).toBeTruthy();
    expect(within(sidePanel).getByTestId('groups-cards').dataset.count).toBe('1');
});

test('DSH-009 renders normal Dashboard for a connected friend with no activity', () => {
    resolveDashboardOnboardingData();
    seedFriends([friend()]);
    renderPage();

    expect(screen.queryByTestId('dashboard-onboarding')).toBeNull();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
});

test('DSH-010 keeps normal Dashboard with a connection and activity', () => {
    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);
    seedDashboard({ items: [activityItem] });
    renderPage();

    expect(screen.queryByTestId('dashboard-onboarding')).toBeNull();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
});

test('DSH-007 preserves an existing dashboard after a failed background refresh', async () => {
    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);
    seedDashboard({ items: [activityItem] });
    const balanceRequests = countRequests(BALANCES_URL, badRequest);
    countRequests(ACTIVITY_URL, () => HttpResponse.json({ items: [], nextCursor: null }));
    await client.refetchQueries({ queryKey: dashboardKeys.balances() });

    renderPage();

    expect(screen.getByTestId('activity-list')).toBeTruthy();
    expect(screen.getByTestId('groups-cards')).toBeTruthy();
    expect(screen.queryByText('errors.loadTitle')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'activity:retryAction' }));
    await waitFor(() => {
        expect(balanceRequests).toHaveLength(2);
    });
});

test('DSH-007 preserves a confirmed dashboard during background refresh loading', () => {
    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);
    server.use(
        http.get(BALANCES_URL, async () => {
            await delay('infinite');
            return HttpResponse.json({ balances: {} });
        }),
    );
    void client.refetchQueries({ queryKey: dashboardKeys.balances() });

    renderPage();

    expect(screen.getByTestId('activity-list')).toBeTruthy();
    expect(screen.queryByTestId('activity-skeleton')).toBeNull();
});

test('DSH-007 keeps confirmed group snapshot visible after list refresh fails', async () => {
    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);
    await failGroupsLoad();

    renderPage();

    expect(screen.getByTestId('groups-cards')).toBeTruthy();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('errors.loadTitle')).toBeNull();
});

test('DSH-007 keeps confirmed friend snapshot visible after friends refresh fails', async () => {
    resolveDashboardOnboardingData();
    seedFriends([friend()]);
    await failFriendsLoad();

    renderPage();

    expect(screen.getByTestId('activity-list')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('errors.loadTitle')).toBeNull();
});

test('DSH-007 preserves a confirmed empty connection list without inventing a new-user state from failure', async () => {
    resolveDashboardOnboardingData();
    seedGroups([]);
    await failFriendsLoad();

    renderPage();

    expect(screen.getByTestId('dashboard-onboarding')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('errors.loadTitle')).toBeNull();
});

test('DSH-007 treats an initial group failure without confirmed data as blocking', async () => {
    resolveDashboardOnboardingData();
    client.removeQueries({ queryKey: groupsKeys.list() });
    await failGroupsLoad();

    renderPage();

    // The mount retries the failed first load once; it fails again.
    expect(await screen.findByText('errors.loadTitle')).toBeTruthy();
    expect(screen.queryByTestId('activity-list')).toBeNull();
});

test('DSH-007 Retry fetches both dashboard data and currency rates', async () => {
    resolveDashboardOnboardingData();
    client.clear();
    seedFriends();
    const balanceRequests = countRequests(BALANCES_URL, badRequest);
    const activityRequests = countRequests(ACTIVITY_URL, badRequest);
    const rateRequests = countRequests(RATES_URL, badRequest);
    const friendRequests = countRequests(KNOWN_USERS_URL, () => HttpResponse.json({ friends: [] }));
    const groupRequests = countRequests(GROUPS_URL, () =>
        HttpResponse.json({ items: [], nextCursor: null }),
    );

    renderPage();
    await waitFor(() => {
        expect(groupRequests).toHaveLength(1);
    });
    fireEvent.click(await screen.findByRole('button', { name: 'activity:retryAction' }));

    await waitFor(() => {
        expect(balanceRequests).toHaveLength(2);
        expect(activityRequests).toHaveLength(2);
        expect(rateRequests).toHaveLength(2);
        // The friends were cached: Retry reloads them too.
        expect(friendRequests).toHaveLength(1);
        // The mount loaded the groups; Retry reloads them.
        expect(groupRequests).toHaveLength(2);
    });
    expect(screen.getByText('errors.loadTitle')).toBeTruthy();
});

test('DSH-007 never mistakes a load failure for new-user welcome', async () => {
    resolveDashboardOnboardingData();
    client.removeQueries({ queryKey: usersKeys.known() });
    await failFriendsLoad();
    renderPage();

    // The mount retries the failed first load once; it fails again.
    expect(await screen.findByText('errors.loadTitle')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-onboarding')).toBeNull();
    expect(screen.queryByTestId('activity-list')).toBeNull();
    expect(screen.getByRole('button', { name: 'activity:retryAction' })).toBeTruthy();
});

test('DSH-007 requires a successfully resolved user before welcome', async () => {
    resolveDashboardOnboardingData();
    client.removeQueries({ queryKey: usersKeys.self() });
    const selfRequests = countRequests(SELF_URL, badRequest);
    renderPage();

    expect(await screen.findByText('errors.loadTitle')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-onboarding')).toBeNull();
    expect(selfRequests).toHaveLength(1);
});

test('DSH-007 Retry reloads a self user that failed to load', async () => {
    resolveDashboardOnboardingData();
    client.removeQueries({ queryKey: usersKeys.self() });
    const selfRequests = countRequests(SELF_URL, badRequest);
    renderPage();
    await screen.findByText('errors.loadTitle');

    const retried = countRequests(SELF_URL, () =>
        HttpResponse.json({ ...currentUser, isPremium: false }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'activity:retryAction' }));

    await waitFor(() => {
        expect(client.getQueryData(usersKeys.self())).toBeDefined();
    });
    expect(selfRequests).toHaveLength(1);
    expect(retried).toHaveLength(1);
});

test('DSH-007 derives welcome from connections, not group lifecycle activity', () => {
    resolveDashboardOnboardingData();
    seedDashboard({ items: [activityItem] });
    renderPage();

    expect(screen.getByTestId('dashboard-onboarding')).toBeTruthy();
});

// The rates of a resolved dashboard fail to load (no cached rates).
const failRates = () => {
    client.removeQueries({ queryKey: currencyRatesKeys.all });
    return countRequests(RATES_URL, badRequest);
};

test('DSH-007 ignores currency-rate failure when onboarding data is resolved', async () => {
    resolveDashboardOnboardingData();
    failRates();

    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByTestId('dashboard-onboarding')).toBeTruthy();
});

test('DSH-007 surfaces a rates-only failure without hiding confirmed Dashboard content', async () => {
    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);
    const rateRequests = failRates();

    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
    expect(screen.getByTestId('groups-cards')).toBeTruthy();
    expect(screen.queryByText('errors.loadTitle')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'activity:retryAction' }));
    await waitFor(() => {
        expect(rateRequests).toHaveLength(2);
    });
});

test('DSH-007 preserves Welcome with a rates-only failure and offers retry', async () => {
    resolveDashboardOnboardingData();
    failRates();

    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByTestId('dashboard-onboarding')).toBeTruthy();
    expect(screen.queryByText('errors.loadTitle')).toBeNull();
});

test('DSH-007 keeps loading while connection inputs resolve', () => {
    seedDashboard();
    seedRates();
    seedGroups();
    seedFriends();
    // The self user is not loaded yet: no `users.self` entry, its load still running.
    client.removeQueries({ queryKey: usersKeys.self() });
    countRequests(SELF_URL, () => new Promise<never>(() => undefined));

    renderPage();

    expect(screen.getByTestId('activity-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-onboarding')).toBeNull();
    expect(screen.queryByTestId('activity-list')).toBeNull();
});

test('ACT-023 connects dashboard infinite scroll to the next activity preview page', async () => {
    seedGroups([singleMemberGroup]);
    resolveDashboardOnboardingData();
    seedDashboard({ items: [activityItem], nextCursor: 40 });
    const activityRequests = countRequests(ACTIVITY_URL, () =>
        HttpResponse.json({ items: [], nextCursor: null }),
    );

    renderPage();

    expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
            hasMore: true,
            isLoading: false,
            loadedKey: expect.stringMatching(/^1:/),
        }),
    );

    const lastCall = useInfiniteScrollMock.mock.lastCall;

    if (!lastCall) {
        throw new Error('Infinite scroll was not initialized');
    }

    lastCall[0].onLoadMore();

    await waitFor(() => {
        expect(activityRequests).toHaveLength(1);
    });
    expect(activityRequests[0]?.searchParams.get('cursor')).toBe('40');
    expect(activityRequests[0]?.searchParams.get('limit')).toBe('20');
    await waitFor(() => {
        expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
            expect.objectContaining({
                hasMore: false,
                loadedKey: expect.stringMatching(/^2:/),
            }),
        );
    });
});

test('ACT-023 a next page paused offline is requested once while offline, then appended once on reconnect', async () => {
    const { useInfiniteScroll } =
        await vi.importActual<typeof import('hooks/useInfiniteScroll')>('hooks/useInfiniteScroll');
    let isBack = false;

    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);
    seedDashboard({ items: [activityItem], nextCursor: 40 });
    // As in production (`createQueryClient`): the first attempt is sent offline, its retry pauses.
    client.setQueryDefaults(activityKeys.all, {
        networkMode: 'offlineFirst',
        retry: 1,
        retryDelay: 0,
    });
    const activityRequests = countRequests(ACTIVITY_URL, () =>
        isBack ? HttpResponse.json({ items: [], nextCursor: null }) : HttpResponse.error(),
    );
    // The real scroll trigger, always in view.
    useInfiniteScrollMock.mockImplementation(useInfiniteScroll);
    vi.stubGlobal(
        'IntersectionObserver',
        class {
            private readonly report: (entries: IntersectionObserverEntry[]) => void;

            constructor(report: (entries: IntersectionObserverEntry[]) => void) {
                this.report = report;
            }

            observe(target: Element): void {
                this.report([{ isIntersecting: true, target } as IntersectionObserverEntry]);
            }

            disconnect(): void {
                // Nothing to release.
            }
        },
    );
    onlineManager.setOnline(false);

    try {
        renderPage();

        await waitFor(
            () => {
                expect(client.getQueryState(FEED_KEY)?.fetchStatus).toBe('paused');
            },
            { timeout: 5000 },
        );
        await new Promise(resolve => setTimeout(resolve, 150));
        expect(activityRequests).toHaveLength(1);
        expect(client.getQueryState(FEED_KEY)?.fetchStatus).toBe('paused');

        isBack = true;
        onlineManager.setOnline(true);

        expect(
            await screen.findByText('activity:endOfFeed', undefined, { timeout: 5000 }),
        ).toBeTruthy();
        expect(activityRequests.map(url => url.searchParams.get('cursor'))).toEqual(['40', '40']);
    } finally {
        onlineManager.setOnline(true);
        useInfiniteScrollMock.mockReset();
        vi.unstubAllGlobals();
    }
});

test('DSH-007 an offline session shows the cached dashboard and feed without a load-failed notice', async () => {
    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);
    seedDashboard({ items: [activityItem] });
    // The restored cache is older than the 30 s staleTime: the mount tries to refresh it, the
    // first attempt fails and the retry waits for the network (as `queryRetry` does offline).
    client.setQueryData(dashboardKeys.balances(), [], { updatedAt: 0 });
    client.setQueryDefaults(dashboardKeys.all, { retry: 1, retryDelay: 0 });
    onlineManager.setOnline(false);
    server.use(http.get(BALANCES_URL, () => HttpResponse.error()));

    try {
        renderPage();

        await waitFor(() => {
            expect(client.getQueryState(dashboardKeys.balances())?.fetchStatus).toBe('paused');
        });
        expect(screen.getByTestId('activity-list')).toBeTruthy();
        expect(screen.getByTestId('groups-cards')).toBeTruthy();
        // Only the OfflineBanner (in the layout) says that the data may be old.
        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.queryByText('errors.loadTitle')).toBeNull();
        expect(screen.queryByTestId('activity-skeleton')).toBeNull();
    } finally {
        onlineManager.setOnline(true);
    }
});

test('DSH-007 offline without cached dashboard data shows the blocking load error', async () => {
    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);
    client.removeQueries({ queryKey: dashboardKeys.balances() });
    client.setQueryDefaults(dashboardKeys.all, { retry: 1, retryDelay: 0 });
    onlineManager.setOnline(false);
    server.use(http.get(BALANCES_URL, () => HttpResponse.error()));

    try {
        renderPage();

        expect(await screen.findByText('errors.loadTitle')).toBeTruthy();
        expect(client.getQueryState(dashboardKeys.balances())?.fetchStatus).toBe('paused');
    } finally {
        onlineManager.setOnline(true);
    }
});

test('ACT-023 a failed next page keeps the feed with its inline Retry and no page alert', async () => {
    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);
    seedDashboard({ items: [activityItem], nextCursor: 40 });
    const activityRequests = countRequests(ACTIVITY_URL, badRequest);

    renderPage();
    const lastCall = useInfiniteScrollMock.mock.lastCall;

    if (!lastCall) {
        throw new Error('Infinite scroll was not initialized');
    }
    lastCall[0].onLoadMore();

    const retry = await screen.findByRole('button', { name: 'activity:retryAction' });

    expect(activityRequests).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('activity-list').contains(retry)).toBe(true);
    expect(screen.queryByText('errors.loadTitle')).toBeNull();
});

test('ACT-023 a remount after 30 s refetches a feed of five loaded pages with one request', async () => {
    resolveDashboardOnboardingData();
    seedGroups([singleMemberGroup]);
    const page = (nextCursor: number | null) => ({ items: [activityItem], nextCursor });
    client.setQueryData(FEED_KEY, {
        pages: [page(50), page(40), page(30), page(20), page(10)],
        pageParams: [null, 50, 40, 30, 20],
    });
    const activityRequests = countRequests(ACTIVITY_URL, () =>
        HttpResponse.json({ items: [wirePreview('activity-1')], nextCursor: 50 }),
    );
    countRequests(BALANCES_URL, () => HttpResponse.json({ balances: {} }));

    vi.useFakeTimers({ toFake: ['Date'] });
    try {
        renderPage().unmount();
        // Back on the dashboard after the 30 s staleTime: the mount refetches the feed.
        vi.setSystemTime(Date.now() + 31_000);
        renderPage();

        await waitFor(() => {
            expect(activityRequests).toHaveLength(1);
        });
        expect(activityRequests[0]?.searchParams.get('cursor')).toBeNull();
        await waitFor(() => {
            expect(client.getQueryState(FEED_KEY)?.fetchStatus).toBe('idle');
        });
        expect(activityRequests).toHaveLength(1);
    } finally {
        vi.useRealTimers();
    }
});

test('renders the shared profile greeting directly in the dashboard side panel at all breakpoints', () => {
    resolveDashboardOnboardingData();
    renderPage();

    const sidePanel = screen.getByTestId('dashboard-side-panel');
    const greeting = within(sidePanel).getByTestId('dashboard-header');

    expect(greeting.parentElement).toBe(sidePanel.firstElementChild);
});

test('DSH-007 a loaded groups list shows the real group cards, not their skeleton', () => {
    groupsCardsMode.real = true;
    resolveDashboardOnboardingData();
    seedGroups([
        {
            ...singleMemberGroup,
            name: 'Weekend Trip',
            // An open balance: the card is listed, not auto-hidden as settled.
            members: [
                ...singleMemberGroup.members,
                {
                    user: { ...creator, id: 'user-2', displayName: 'Bob' },
                    balancesByCurrency: groupBalances({ USD: 5 }),
                },
            ],
        },
    ]);

    renderWithQueryClient(
        <MemoryRouter>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <DashboardPage />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
        client,
    );

    const sidePanel = screen.getByTestId('dashboard-side-panel');

    expect(within(sidePanel).getByText('Weekend Trip')).toBeTruthy();
    expect(within(sidePanel).getByRole('group', { name: 'groups.filtersLabel' })).toBeTruthy();
});
