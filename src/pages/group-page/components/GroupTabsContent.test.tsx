import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AppEvent } from 'api/activity.types';
import type { Group } from 'api/chipin.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';

import GroupTabsContent from './GroupTabsContent';

const useInfiniteScrollMock = vi.hoisted(() =>
    vi.fn<
        (params: {
            hasMore: boolean;
            isLoading: boolean;
            onLoadMore: () => Promise<void>;
        }) => () => void
    >(() => vi.fn()),
);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('hooks/useInfiniteScroll', () => ({
    useInfiniteScroll: useInfiniteScrollMock,
}));

vi.mock('components/modals/settle-up-modal', () => ({
    SettleUpModal: ({ group }: { group: Group }) => (
        <button type="button">{group.id}</button>
    ),
}));

vi.mock('components/skeletons', () => ({
    ActivityFeedSkeleton: () => <div data-testid="activity-skeleton" />,
}));

vi.mock('features/activity', () => ({
    ActivityEventsList: ({
        children,
        emptyState,
        events,
    }: {
        children?: ReactNode;
        emptyState?: ReactNode;
        events: AppEvent[];
    }) => events.length === 0 ? <>{emptyState}</> : <>{children}</>,
}));

vi.mock('./GroupBalancesTab', () => ({ default: () => null }));
vi.mock('./GroupInviteActions', () => ({
    default: ({ group }: { group: Group }) => (
        <div data-testid="group-invite-actions">{group.id}</div>
    ),
}));
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
    members: [
        ...group.members,
        { user: secondMember, balancesByCurrency: {} },
    ],
} satisfies Group;

const activityItem = {
    parent: { id: 'parent-1' } as AppEvent,
    lastEvent: { id: 'event-1' } as AppEvent,
};

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

const defaultProps = {
    isGroupDataLoading: false,
    fetchMoreGroupActivity: vi.fn(() => Promise.resolve()),
    isGroupActivityNextPageLoading: false,
    isGroupActivityNextPageError: false,
};

beforeEach(() => {
    vi.clearAllMocks();
});

test('renders member actions on the left and settle up on the right before tabs', () => {
    render(<GroupTabsContent group={group} {...defaultProps} />);

    const settleUp = screen.getByRole('button', {
        name: group.id,
    });
    const invitePeople = screen.getByRole('button', {
        name: 'common:buttons.invitePeople',
    });
    const tabsNav = screen.getByRole('tablist');
    const actions = tabsNav.previousElementSibling;
    const memberActions = actions?.firstElementChild;

    expect(actions?.lastElementChild).toBe(settleUp.parentElement);
    expect(memberActions).not.toBeNull();
    expect(memberActions?.firstElementChild?.children).toHaveLength(
        group.members.length,
    );
    expect(memberActions?.contains(invitePeople)).toBe(true);
});

test('triggers group activity pagination from the active Expenses tab', () => {
    render(<GroupTabsContent group={groupWithActivity} {...defaultProps} />);

    expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ hasMore: true, isLoading: false }),
    );

    const lastCall = useInfiniteScrollMock.mock.lastCall;

    if (!lastCall) {
        throw new Error('Infinite scroll was not initialized');
    }

    return lastCall[0].onLoadMore().then(() => {
        expect(defaultProps.fetchMoreGroupActivity).toHaveBeenCalledOnce();
    });
});

test('suppresses group activity pagination while another tab is active', () => {
    const user = userEvent.setup();
    render(<GroupTabsContent group={groupWithActivity} {...defaultProps} />);

    return user
        .click(screen.getByRole('tab', { name: /page\.tabs\.balances/ }))
        .then(() => {
            expect(useInfiniteScrollMock).toHaveBeenLastCalledWith(
                expect.objectContaining({ hasMore: false }),
            );
        });
});

test('renders the retained activity list retry action after an incremental failure', () => {
    const fetchMoreGroupActivity = vi.fn(() => Promise.resolve());
    render(
        <GroupTabsContent
            group={groupWithActivity}
            {...defaultProps}
            fetchMoreGroupActivity={fetchMoreGroupActivity}
            isGroupActivityNextPageError
        />,
    );

    return userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'activity:retryAction' }))
        .then(() => {
            expect(fetchMoreGroupActivity).toHaveBeenCalledOnce();
        });
});

test('renders the group activity exhausted marker after the last page', () => {
    render(
        <GroupTabsContent
            group={{ ...groupWithActivity, recentActivities: { items: [activityItem], nextCursor: null } }}
            {...defaultProps}
        />,
    );

    expect(screen.getByText('activity:endOfFeed')).not.toBeNull();
});

test('renders invite onboarding instead of No expenses for a single-member group', () => {
    render(<GroupTabsContent group={group} {...defaultProps} />);

    expect(screen.getByText('page.expenses.inviteTitle')).not.toBeNull();
    expect(screen.getByText('page.expenses.inviteDescription')).not.toBeNull();
    expect(screen.getByTestId('group-invite-actions').textContent).toBe(group.id);
    expect(screen.queryByText('page.expenses.emptyTitle')).toBeNull();
});

test('renders invite onboarding when the feed only contains group lifecycle activity', () => {
    render(<GroupTabsContent group={groupWithLifecycleActivity} {...defaultProps} />);

    expect(screen.getByText('page.expenses.inviteTitle')).not.toBeNull();
    expect(screen.getByText('page.expenses.inviteDescription')).not.toBeNull();
    expect(screen.getByTestId('group-invite-actions').textContent).toBe(group.id);
    expect(screen.queryByText('page.expenses.emptyTitle')).toBeNull();
});

test('renders the group expenses empty state once the group has another member', () => {
    render(<GroupTabsContent group={groupWithTwoMembers} {...defaultProps} />);

    expect(screen.getByText('page.expenses.emptyTitle')).not.toBeNull();
    expect(screen.queryByText('page.expenses.inviteTitle')).toBeNull();
});

test('does not render an empty-state prompt when the activity feed is populated', () => {
    render(<GroupTabsContent group={groupWithActivity} {...defaultProps} />);

    expect(screen.queryByText('page.expenses.inviteTitle')).toBeNull();
    expect(screen.queryByText('page.expenses.emptyTitle')).toBeNull();
});

test('keeps the full skeleton for initial group loading', () => {
    render(
        <GroupTabsContent
            group={group}
            {...defaultProps}
            isGroupDataLoading
        />,
    );

    expect(screen.getByTestId('activity-skeleton')).not.toBeNull();
});
