import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { useActivityStore } from 'store/activity-store';
import { useLoadingStore } from 'store/loadingStore';

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
        subeventsParent: null,
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
        subeventsParent: parentEvent,
    });

    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);

    expect(screen.queryByText('subeventsUpdateAction')).toBeNull();
    expect(screen.queryByText('subeventsDeleteAction')).toBeNull();
});

test('uses the stable root id when the canonical parent snapshot is a child event', () => {
    useActivityStore.setState({
        subevents: [reversedEvent],
        subeventsParent: parentEvent,
    });

    render(<ActivitySubeventsButtons parentEvent={reversedEvent} />);

    expect(screen.queryByText('subeventsUpdateAction')).toBeNull();
    expect(screen.queryByText('subeventsDeleteAction')).toBeNull();
});

test('delegates entry reversal and its refetches to the activity store', () => {
    const user = userEvent.setup();
    const reverseLedgerEntry = vi.fn().mockResolvedValue(true);

    useActivityStore.setState({
        reverseLedgerEntry,
        subevents: [],
        subeventsParent: parentEvent,
    });
    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);

    return user
        .click(screen.getByRole('button', { name: 'subeventsDeleteAction' }))
        .then(() => {
            expect(reverseLedgerEntry).not.toHaveBeenCalled();
            expect(screen.getByRole('alertdialog')).toBeTruthy();

            return user.click(
                screen.getByRole('button', { name: 'subeventsDeleteConfirmAction' }),
            );
        })
        .then(() =>
            waitFor(() => {
                expect(reverseLedgerEntry).toHaveBeenCalledWith({
                    entryId: 'expense-id',
                    groupId: undefined,
                    parentActivityId: parentEvent.id,
                });
            }),
        );
});

test('keeps the confirmation open when deleting an entry fails', () => {
    const user = userEvent.setup();
    const reverseLedgerEntry = vi.fn().mockRejectedValue(new Error('Delete failed'));

    useActivityStore.setState({
        reverseLedgerEntry,
        subevents: [],
        subeventsParent: parentEvent,
    });
    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);

    return user
        .click(screen.getByRole('button', { name: 'subeventsDeleteAction' }))
        .then(() => {
            return user.click(
                screen.getByRole('button', { name: 'subeventsDeleteConfirmAction' }),
            );
        })
        .then(() => {
            return waitFor(() => {
                expect(screen.getByRole('alertdialog')).toBeTruthy();
                expect(
                    screen.getByRole('button', { name: 'subeventsDeleteConfirmAction' }),
                ).toHaveProperty('disabled', false);
            });
        });
});
