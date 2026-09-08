import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';

import { EventSettlement } from './EventSettlement';

vi.mock('basics', importOriginal =>
    importOriginal<typeof import('basics')>().then(basics => ({
        ...basics,
        Amount: ({
            tokenCode,
            type,
            value,
        }: {
            tokenCode?: string;
            type?: string;
            value: number;
        }) => (
            <span data-testid="settlement-full-amount" data-type={type}>
                {value} {tokenCode}
            </span>
        ),
        RelativeTime: () => <time data-testid="relative-time" />,
    })),
);

vi.mock('./styled', importOriginal =>
    importOriginal<typeof import('./styled')>().then(styledComponents => ({
        ...styledComponents,
        AmountText: ({
            children,
            $isReversed,
        }: {
            children: ReactNode;
            $isReversed: boolean;
        }) => (
            <span
                data-testid="settlement-amount"
                data-is-reversed={String($isReversed)}
            >
                {children}
            </span>
        ),
    })),
);

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { payer?: string }) => {
            if (key === 'event.paidAmount') {
                return `${options?.payer} paid`;
            }

            if (key === 'event.you') {
                return 'You';
            }

            return key;
        },
    }),
}));

vi.mock('store/users-store', () => ({
    useUsersStore: (selector: (state: { user: { id: string } }) => unknown) =>
        selector({ user: { id: 'current-user' } }),
}));

vi.mock('store/groupsStore', () => ({
    useGroupsStore: (selector: (state: { groups: []; selectedGroup: null }) => unknown) =>
        selector({ groups: [], selectedGroup: null }),
}));

const createSettlementEvent = ({
    groupId,
    groupName,
    action = ACTIVITY_ACTIONS.SETTLEMENT_CREATED,
}: {
    groupId: string | null;
    groupName: string | null;
    action?:
        | typeof ACTIVITY_ACTIONS.SETTLEMENT_CREATED
        | typeof ACTIVITY_ACTIONS.SETTLEMENT_REVERSED;
}): Extract<
    AppEvent,
    {
        action:
            | typeof ACTIVITY_ACTIONS.SETTLEMENT_CREATED
            | typeof ACTIVITY_ACTIONS.SETTLEMENT_REVERSED;
    }
> => ({
    id: 'activity-1',
    seq: 1,
    domain: 'LEDGER',
    action,
    actorUserId: 'to-user',
    actorSnapshot: {
        displayName: 'Huek',
        picture: 'actor-picture',
    },
    subjectType: 'settlement',
    subjectId: 'settlement-1',
    groupId,
    metadata: {
        type: 'settlement',
        entryId: 'settlement-1',
        groupId,
        groupName,
        amount: 30,
        currency: 'USD',
        actorUserId: 'to-user',
        payerId: 'from-user',
        fromDisplayName: 'Ilya Govor',
        toDisplayName: 'Huek',
    },
    createdAt: 1_785_328_628,
    parentActivityId: null,
});

test('shows participants and group scope', () => {
    render(
        <EventSettlement
            event={createSettlementEvent({
                groupId: 'group-1',
                groupName: 'Vietnam',
            })}
        />,
    );

    expect(screen.getByText('Ilya Govor')).toBeTruthy();
    expect(screen.getByText('event.paidTo')).toBeTruthy();
    expect(screen.getByText('Huek')).toBeTruthy();
    expect(screen.getByText('Ilya Govor paid')).toBeTruthy();
    expect(screen.getByText('30 USD')).toBeTruthy();
    expect(screen.getByText('Vietnam')).toBeTruthy();
    expect(screen.queryByTestId('relative-time')).toBeNull();
    expect(screen.getByTestId('settlement-full-amount').dataset.type).toBe(
        'summary',
    );
});

test('uses You when the current user paid the settlement', () => {
    const event = createSettlementEvent({
        groupId: 'group-1',
        groupName: 'Vietnam',
    });
    event.metadata.payerId = 'current-user';

    render(<EventSettlement event={event} />);

    expect(screen.getByText('You paid')).toBeTruthy();
    expect(screen.getAllByTestId('settlement-full-amount')).toHaveLength(1);
});

test('shows between friends for a direct settlement', () => {
    render(
        <EventSettlement
            event={createSettlementEvent({
                groupId: null,
                groupName: null,
            })}
        />,
    );

    expect(screen.getByText('event.betweenFriends')).toBeTruthy();
});

test('strikes reversed settlement values and shows deletion context', () => {
    render(
        <EventSettlement
            event={createSettlementEvent({
                groupId: null,
                groupName: null,
                action: ACTIVITY_ACTIONS.SETTLEMENT_REVERSED,
            })}
        />,
    );

    expect(getComputedStyle(screen.getByText('Ilya Govor')).textDecoration).toBe(
        'line-through',
    );
    expect(getComputedStyle(screen.getByText('event.paidTo')).textDecoration).toBe(
        'line-through',
    );
    expect(getComputedStyle(screen.getByText('Huek')).textDecoration).toBe(
        'line-through',
    );
    expect(screen.getByTestId('settlement-amount').dataset.isReversed).toBe(
        'true',
    );
    expect(
        screen.getByText('event.settlementReversedDescription'),
    ).toBeTruthy();
});
