import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import type { Group } from 'api/chipin.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import type { ActivityPreview } from 'entities/activity';
import { legacyActivityPreview } from 'entities/balance';
import type { GroupActivityResult } from 'hooks/useGroupDetail';
import { legacyPreview } from 'test/activityFixtures';
import { toTestGroup } from 'test/groupFixtures';

import GroupTabsContent from './GroupTabsContent';

const inviteMocks = vi.hoisted(() => ({
    onShare: vi.fn(() => Promise.resolve()),
    onCopyLink: vi.fn(() => Promise.resolve()),
}));

const useInfiniteScrollMock = vi.hoisted(() =>
    vi.fn<(params: { hasMore: boolean; isLoading: boolean; onLoadMore: () => void }) => () => void>(
        () => vi.fn(),
    ),
);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('hooks/useInfiniteScroll', () => ({
    useInfiniteScroll: useInfiniteScrollMock,
}));

vi.mock('hooks/pwaHooks', () => ({
    useGroupInvite: () => ({
        inviteLink: 'https://chipin.one/invite/group-1',
        isNativeShareSupported: true,
        isShareDone: false,
        isCopied: false,
        qr: {
            title: 'group:qr.title',
            accessibleDescription: 'group:qr.description',
            description: 'group:qr.joinDescription',
            subtitle: 'group:page.settings.showQRSubtitle',
        },
        onShare: inviteMocks.onShare,
        onCopyLink: inviteMocks.onCopyLink,
    }),
}));

vi.mock('components/modals/settle-up-modal', () => ({
    SettleUpModal: ({ group }: { group: Group }) => <button type="button">{group.id}</button>,
}));

vi.mock('components/skeletons', () => ({
    ActivityFeedSkeleton: () => <div data-testid="activity-skeleton" />,
}));

vi.mock('features/activity', () => ({
    ActivityEventsList: ({
        children,
        emptyState,
        previews,
    }: {
        children?: ReactNode;
        emptyState?: ReactNode;
        previews: readonly ActivityPreview[];
    }) => (previews.length === 0 ? <>{emptyState}</> : <>{children}</>),
}));

vi.mock('./GroupBalancesTab', () => ({ default: () => null }));
vi.mock('./GroupSettingsTab', () => ({ default: () => null }));

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
    coverUrl: null,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: { items: [], nextCursor: null },
} satisfies Group;

const secondMember = {
    ...creator,
    id: 'user-2',
    email: 'bob@example.com',
    displayName: 'Bob',
    firstName: 'Bob',
};

const groupWithTwoMembers = {
    ...group,
    members: [...group.members, { user: secondMember, balancesByCurrency: {} }],
} satisfies Group;

const activityItem = legacyPreview('parent-1');

const groupWithActivity = {
    ...group,
    lastUsedCurrency: 'USD',
    recentActivities: {
        items: [activityItem],
        nextCursor: 20,
    },
} satisfies Group;

const groupCreatedEvent = {
    id: 'group-created',
    seq: 1,
    domain: 'GROUP',
    action: ACTIVITY_ACTIONS.GROUP_CREATED,
    actorUserId: creator.id,
    actorSnapshot: {
        displayName: creator.displayName,
        picture: creator.picture,
    },
    subjectType: 'group',
    subjectId: group.id,
    groupId: group.id,
    metadata: {
        type: 'group',
        groupId: group.id,
        groupName: group.name,
    },
    createdAt: 1,
} satisfies AppEvent;

const groupWithLifecycleActivity = {
    ...group,
    recentActivities: {
        items: [{ parent: groupCreatedEvent, lastEvent: groupCreatedEvent }],
        nextCursor: null,
    },
} satisfies Group;

const loadMore = vi.fn();

// The group's activity as `useGroupActivity` returns it: its first page loaded.
const activityOf = (
    target: Group,
    overrides: Partial<GroupActivityResult> = {},
): GroupActivityResult => ({
    items: target.recentActivities.items.map(legacyActivityPreview),
    hasMore: target.recentActivities.nextCursor !== null,
    isFetching: false,
    isNextPageLoading: false,
    isNextPageError: false,
    loadMore,
    ...overrides,
});

const renderTabs = (
    target: Group,
    {
        isGroupDataLoading = false,
        ...overrides
    }: Partial<GroupActivityResult> & {
        isGroupDataLoading?: boolean;
    } = {},
) =>
    render(
        <GroupTabsContent
            group={toTestGroup(target)}
            isGroupDataLoading={isGroupDataLoading}
            activity={activityOf(target, overrides)}
        />,
    );

beforeEach(() => {
    vi.clearAllMocks();
});

test('renders member actions on the left and settle up on the right before tabs', () => {
    renderTabs(group);

    const settleUp = screen.getByRole('button', {
        name: group.id,
    });
    const tabsNav = screen.getByRole('tablist');
    const actions = tabsNav.previousElementSibling;
    const memberActions = actions?.firstElementChild;

    expect(actions?.lastElementChild).toBe(settleUp.parentElement);
    expect(memberActions).not.toBeNull();
    expect(memberActions?.firstElementChild?.children).toHaveLength(group.members.length);

    if (!(memberActions instanceof HTMLElement)) {
        throw new Error('Member actions were not rendered');
    }

    expect(
        within(memberActions).getByRole('button', {
            name: 'common:buttons.invitePeople',
        }),
    ).toBeTruthy();
});

test('starts the existing invite flow from the member action button', () => {
    const user = userEvent.setup();
    renderTabs(groupWithTwoMembers);

    return user
        .click(
            screen.getByRole('button', {
                name: 'common:buttons.invitePeople',
            }),
        )
        .then(() => {
            expect(inviteMocks.onShare).toHaveBeenCalledOnce();
        });
});

test('triggers group activity pagination from the active Expenses tab', () => {
    renderTabs(groupWithActivity);

    expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ hasMore: true, isLoading: false }),
    );

    const lastCall = useInfiniteScrollMock.mock.lastCall;

    if (!lastCall) {
        throw new Error('Infinite scroll was not initialized');
    }

    lastCall[0].onLoadMore();

    expect(loadMore).toHaveBeenCalledOnce();
});

test('holds the scroll trigger during any activity load, not only a next page', () => {
    renderTabs(groupWithActivity, { isFetching: true, isNextPageLoading: false });

    expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ hasMore: true, isLoading: true }),
    );
});

test('suppresses group activity pagination while another tab is active', () => {
    const user = userEvent.setup();
    renderTabs(groupWithActivity);

    return user.click(screen.getByRole('tab', { name: /page\.tabs\.balances/ })).then(() => {
        expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
            expect.objectContaining({ hasMore: false }),
        );
    });
});

test('renders the retained activity list retry action after an incremental failure', () => {
    renderTabs(groupWithActivity, { isNextPageError: true });

    return userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'activity:retryAction' }))
        .then(() => {
            expect(loadMore).toHaveBeenCalledOnce();
        });
});

test('renders the group activity exhausted marker after the last page', () => {
    renderTabs({
        ...groupWithActivity,
        recentActivities: { items: [activityItem], nextCursor: null },
    });

    expect(screen.getByText('activity:endOfFeed')).not.toBeNull();
});

test('renders shared illustrated invite onboarding instead of No expenses for a single-member group', () => {
    renderTabs(group);

    expect(screen.getByText('page.expenses.inviteTitle')).not.toBeNull();
    expect(screen.getByText('page.expenses.inviteDescription')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'page.expenses.inviteAction' })).not.toBeNull();
    expect(screen.getByText('page.expenses.shareVia')).not.toBeNull();
    expect(
        screen.getByRole('button', {
            name: /group:page\.settings\.showQRTitle/,
        }),
    ).not.toBeNull();
    expect(screen.queryByText('page.expenses.emptyTitle')).toBeNull();
});

test('keeps shared invite onboarding when the feed only contains group lifecycle activity', () => {
    renderTabs(groupWithLifecycleActivity);

    expect(screen.getByText('page.expenses.inviteTitle')).not.toBeNull();
    expect(screen.getByText('page.expenses.inviteDescription')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'page.expenses.inviteAction' })).not.toBeNull();
    expect(screen.queryByText('page.expenses.emptyTitle')).toBeNull();
});

test('renders the group expenses empty state once the group has another member', () => {
    renderTabs(groupWithTwoMembers);

    expect(screen.getByText('page.expenses.emptyTitle')).not.toBeNull();
    expect(screen.queryByText('page.expenses.inviteTitle')).toBeNull();
});

test('keeps the invite hint in a single-member group with existing activity', () => {
    renderTabs(groupWithActivity);

    expect(screen.getByText('page.expenses.inviteTitle')).not.toBeNull();
    expect(screen.queryByText('page.expenses.emptyTitle')).toBeNull();
});

test('keeps the full skeleton for initial group loading', () => {
    renderTabs(group, { isGroupDataLoading: true });

    expect(screen.getByTestId('activity-skeleton')).not.toBeNull();
});
