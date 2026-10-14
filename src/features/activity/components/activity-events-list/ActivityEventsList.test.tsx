import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import type { ActivityFeedItem } from 'api/chipin.types';
import type { BalanceEntry } from 'api/chipin.raw.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { getActivityPreviewEvents } from 'helpers/activityEvent';

import { ActivityEventsList } from './ActivityEventsList';

vi.mock('store/users-store', () => ({
    useUsersStore: (selector: (state: { user: { id: string } }) => unknown) =>
        selector({ user: { id: 'me' } }),
}));

vi.mock('basics/empty-states', () => ({
    NoActivityEmptyState: () => null,
}));

vi.mock('../activity-event', () => ({
    FullActivityFeedContext: {
        Provider: ({ children }: { children: ReactNode }) => <>{children}</>,
    },
    ActivityEvent: ({
        event,
        parentActivityId,
    }: {
        event: AppEvent;
        parentActivityId?: string;
    }) => (
        <div data-testid="activity-card" data-parent-id={parentActivityId}>
            {event.id}
        </div>
    ),
}));

vi.mock('../ActivityDateDivider', () => ({
    default: ({ createdAt, summary }: { createdAt: number; summary: BalanceEntry[] }) => (
        <div data-testid="activity-divider" data-created-at={createdAt}>
            {JSON.stringify(summary)}
        </div>
    ),
}));

const DAY_A = 1785328628;
const DAY_B = DAY_A + 3 * 86400;

const expense = (
    id: string,
    amount: number,
    createdAt = DAY_A,
    action: typeof ACTIVITY_ACTIONS.EXPENSE_CREATED | typeof ACTIVITY_ACTIONS.EXPENSE_UPDATED =
        ACTIVITY_ACTIONS.EXPENSE_CREATED,
): AppEvent => ({
    id,
    seq: 1,
    domain: 'LEDGER',
    action,
    actorSnapshot: { displayName: 'Friend' },
    subjectType: 'expense',
    subjectId: id,
    groupId: null,
    metadata: {
        type: 'expense',
        entryId: id,
        amount,
        currency: 'USD',
        payerId: 'friend',
        payerDisplayName: 'Friend',
        shares: [{ userId: 'me', shareAmount: amount, currency: 'USD', displayName: 'Me' }],
    },
    createdAt,
    parentActivityId: null,
});

test('ACT-021 groups by parent date and displays latest edited expense with original navigation ID', () => {
    const original = expense('original-parent', 6000);
    const changed = expense('edited-child', 6000, DAY_B, ACTIVITY_ACTIONS.EXPENSE_UPDATED);
    const other = expense('other-parent', 1000);
    const items: ActivityFeedItem[] = [
        { parent: original, lastEvent: changed },
        { parent: other, lastEvent: other },
    ];

    render(<ActivityEventsList events={getActivityPreviewEvents(items)} isShowSummary isNavigable />);

    expect(screen.getAllByTestId('activity-divider')).toHaveLength(1);
    expect(screen.getByTestId('activity-divider').getAttribute('data-created-at'))
        .toBe(String(DAY_A));
    expect(screen.getByTestId('activity-divider').textContent)
        .toContain('"netBalance":-7000');
    expect(screen.getByText('edited-child').getAttribute('data-parent-id'))
        .toBe('original-parent');
});

test('ACT-023 renders each logical preview once across duplicate page entries', () => {
    const one = expense('parent-one', 3);
    const two = expense('parent-two', 2);
    const items = getActivityPreviewEvents([
        { parent: one, lastEvent: one },
        { parent: two, lastEvent: two },
        { parent: two, lastEvent: two },
    ]);
    render(<ActivityEventsList events={items} isShowSummary />);

    expect(screen.getAllByTestId('activity-card')).toHaveLength(2);
    expect(screen.getByTestId('activity-divider').textContent)
        .toContain('"netBalance":-5');
});

test('ACT-020 still renders individual flat activity events on their own dates', () => {
    const original = expense('flat-original', 10);
    const edit = expense('flat-edit', 20, DAY_B, ACTIVITY_ACTIONS.EXPENSE_UPDATED);

    render(<ActivityEventsList events={[original, edit]} isFullActivityFeed />);

    expect(screen.getAllByTestId('activity-card')).toHaveLength(2);
    expect(screen.getAllByTestId('activity-divider')).toHaveLength(2);
    expect(screen.getAllByTestId('activity-divider')[1].getAttribute('data-created-at'))
        .toBe(String(DAY_B));
    expect(screen.getByText('flat-edit').getAttribute('data-parent-id')).toBeNull();
});
