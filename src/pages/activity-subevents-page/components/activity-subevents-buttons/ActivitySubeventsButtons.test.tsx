import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { useActivityStore } from 'store/activity-store';
import { useExpenseModalStore } from 'store/expenseModalStore';
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
    actorSnapshot: { displayName: 'Alex', picture: null },
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
    seq: 2,
    action: ACTIVITY_ACTIONS.EXPENSE_REVERSED,
    parentActivityId: parentEvent.id,
} satisfies AppEvent;

beforeEach(() => {
    useActivityStore.setState({ subevents: [] });
    useLoadingStore.getState().setInitialLoadingStore();
});

afterEach(() => {
    useExpenseModalStore.getState().reset();
});

test('opens the shared editor from the current activity snapshot', async () => {
    const user = userEvent.setup();
    const initializeEdit = vi.fn();
    const prepareExpenseEdit = vi.fn().mockReturnValue({ mode: 'edit' });
    const originalInitializeEdit = useExpenseModalStore.getState().initializeEdit;

    useActivityStore.setState({ prepareExpenseEdit });
    useExpenseModalStore.setState({ initializeEdit });
    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);

    await user.click(screen.getByRole('button', { name: 'subeventsUpdateAction' }));

    expect(prepareExpenseEdit).toHaveBeenCalledWith({
        parentEvent,
        childEvents: [],
        parentActivityId: parentEvent.id,
    });
    expect(initializeEdit).toHaveBeenCalledWith({ mode: 'edit' });

    useExpenseModalStore.setState({ initializeEdit: originalInitializeEdit });
});

test('hides edit and delete actions when the latest event is reversed', () => {
    render(
        <ActivitySubeventsButtons
            parentEvent={parentEvent}
            currentEvent={reversedEvent}
            childEvents={[reversedEvent]}
        />,
    );

    expect(screen.queryByText('subeventsUpdateAction')).toBeNull();
    expect(screen.queryByText('subeventsDeleteAction')).toBeNull();
});

test('delegates deletion to the activity store', () => {
    const user = userEvent.setup();
    const reverseLedgerEntry = vi.fn().mockResolvedValue(undefined);

    useActivityStore.setState({ reverseLedgerEntry });
    render(<ActivitySubeventsButtons parentEvent={parentEvent} />);

    return user
        .click(screen.getByRole('button', { name: 'subeventsDeleteAction' }))
        .then(() => user.click(screen.getByRole('button', { name: 'subeventsDeleteConfirmAction' })))
        .then(() => waitFor(() => {
            expect(reverseLedgerEntry).toHaveBeenCalledWith({
                entryId: 'expense-id',
                groupId: undefined,
                parentActivityId: parentEvent.id,
            });
        }));
});
