import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { useActivityStore } from 'store/activity-store';
import { useDashboardStore } from 'store/dashboardStore';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import { ActivitySubeventsButtons } from './ActivitySubeventsButtons';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

const parentEvent = {
    id: 'activity-id',
    seq: 1,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
    actorUserId: 'user-id',
    actorSnapshot: {
        displayName: 'Alex',
        picture: null,
    },
    subjectType: 'expense',
    subjectId: 'expense-id',
    groupId: null,
    metadata: {
        type: 'expense',
        entryId: 'expense-id',
        groupId: null,
        groupName: null,
        description: 'Dinner',
        amount: 30,
        currency: 'USD',
        payerId: 'user-id',
        payerDisplayName: 'Alex',
        shares: [],
        fieldDiffs: [],
    },
    createdAt: 1_785_328_628,
    parentActivityId: null,
} satisfies AppEvent;

const reversedEvent = {
    ...parentEvent,
    id: 'reversed-activity-id',
    action: ACTIVITY_ACTIONS.EXPENSE_REVERSED,
    parentActivityId: parentEvent.id,
} satisfies AppEvent;

beforeEach(() => {
    useActivityStore.setState({
        subevents: [],
        subeventsParentId: null,
    });
    useLoadingStore.getState().setInitialLoadingStore();
});

test('shows action skeletons while subevents are loading', () => {
    useLoadingStore
        .getState()
        .setLoading('activity', 'subeventsData', 'loading');

    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);

    expect(screen.getByText('subeventsUpdateAction')).toBeTruthy();
    expect(screen.getByText('subeventsDeleteAction')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
});

test('hides actions after a reversed expense is loaded', () => {
    useActivityStore.setState({
        subevents: [reversedEvent],
        subeventsParentId: parentEvent.id,
    });

    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);

    expect(screen.queryByText('subeventsUpdateAction')).toBeNull();
    expect(screen.queryByText('subeventsDeleteAction')).toBeNull();
});

test('refetches financial data after deleting an entry', () => {
    const user = userEvent.setup();
    const removeLedgerEntry = vi.fn().mockResolvedValue(undefined);
    const fetchSetActivity = vi.fn().mockResolvedValue(undefined);
    const fetchSetActivitySubevents = vi.fn().mockResolvedValue(undefined);
    const fetchSetDashboardData = vi.fn();
    const fetchSetGroups = vi.fn().mockResolvedValue([]);
    const fetchSetFriends = vi.fn();

    useActivityStore.setState({
        subevents: [],
        subeventsParentId: parentEvent.id,
        removeLedgerEntry,
        fetchSetActivity,
        fetchSetActivitySubevents,
    });
    useDashboardStore.setState({
        fetchSetDashboardData,
    });
    useGroupsStore.setState({
        fetchSetGroups,
    });
    useUsersStore.setState({
        user: null,
        fetchSetFriends,
    });

    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);

    return user
        .click(screen.getByRole('button', { name: 'subeventsDeleteAction' }))
        .then(() =>
            waitFor(() => {
                expect(removeLedgerEntry).toHaveBeenCalledWith('expense-id');
                expect(fetchSetActivitySubevents).toHaveBeenCalledWith({
                    parentActivityId: parentEvent.id,
                    category: 'expense',
                });
                expect(fetchSetActivity).toHaveBeenCalledOnce();
                expect(fetchSetDashboardData).toHaveBeenCalledOnce();
                expect(fetchSetGroups).toHaveBeenCalledOnce();
                expect(fetchSetFriends).toHaveBeenCalledOnce();
            }),
        );
});
