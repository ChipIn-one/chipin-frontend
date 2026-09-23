import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { useActivityStore } from 'store/activity-store';
import { useLoadingStore } from 'store/loadingStore';

import ActivitySubeventsPage from './ActivitySubeventsPage';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('components/nav-bars', () => ({
    MobileNavBar: () => null,
}));

vi.mock('components/page-breadcrumb', () => ({
    PageBreadcrumb: ({ title }: { title: string }) => (
        <span data-testid="page-breadcrumb">{title}</span>
    ),
}));

vi.mock('./components', () => ({
    ActivitySubeventsDetails: () => <span data-testid="subevents-details" />,
    ActivitySubeventsFeed: () => <span data-testid="subevents-feed" />,
    ActivitySubeventsHeader: ({
        isUnavailable,
    }: {
        isUnavailable: boolean;
    }) => (
        isUnavailable
            ? <span data-testid="parent-unavailable" />
            : <span data-testid="subevents-header" />
    ),
}));

const expenseParentEvent = {
    id: 'activity-1',
    seq: 1,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
    actorUserId: 'user-1',
    actorSnapshot: {
        displayName: 'Alex',
        picture: null,
    },
    subjectType: 'expense',
    subjectId: 'expense-1',
    groupId: null,
    metadata: {
        type: 'expense',
        entryId: 'expense-1',
        groupId: null,
        groupName: null,
        description: 'Dinner',
        amount: 30,
        currency: 'USD',
        payerId: 'user-1',
        payerDisplayName: 'Alex',
        shares: [],
    },
    createdAt: 1_785_328_628,
    parentActivityId: null,
} satisfies AppEvent;

const settlementParentEvent = {
    id: 'activity-1',
    seq: 1,
    domain: 'LEDGER',
    action: ACTIVITY_ACTIONS.SETTLEMENT_CREATED,
    actorUserId: 'user-1',
    actorSnapshot: {
        displayName: 'Alex',
        picture: null,
    },
    subjectType: 'settlement',
    subjectId: 'settlement-1',
    groupId: null,
    metadata: {
        type: 'settlement',
        entryId: 'settlement-1',
        groupId: null,
        groupName: null,
        amount: 30,
        currency: 'USD',
        payerId: 'user-1',
        fromDisplayName: 'Alex',
        toDisplayName: 'Sam',
    },
    createdAt: 1_785_328_628,
    parentActivityId: null,
} satisfies AppEvent;

const renderPage = (parentEvent: AppEvent | null) => {
    useActivityStore.setState({
        subevents: [],
        subeventsParent: parentEvent,
    });
    useLoadingStore.getState().setInitialLoadingStore();

    return render(
        <MemoryRouter initialEntries={['/activity/activity-1']}>
            <Routes>
                <Route
                    path="/activity/:parentActivityId"
                    element={<ActivitySubeventsPage />}
                />
            </Routes>
        </MemoryRouter>,
    );
};

test('shows a parent fallback and still loads children on a direct visit', () => {
    renderPage(null);

    expect(screen.getByTestId('parent-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('subevents-details')).toBeTruthy();
    expect(screen.getByTestId('subevents-feed')).toBeTruthy();
    expect(screen.queryByTestId('page-breadcrumb')).toBeNull();
});

test('renders the expense breadcrumb before the details column', () => {
    renderPage(expenseParentEvent);

    const breadcrumb = screen.getByTestId('page-breadcrumb');
    const details = screen.getByTestId('subevents-details');

    expect(breadcrumb.textContent).toBe('subeventsExpenseHistoryTitle');
    expect(
        breadcrumb.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
});

test('preserves the settlement breadcrumb title', () => {
    renderPage(settlementParentEvent);

    expect(screen.getByTestId('page-breadcrumb').textContent)
        .toBe('subeventsSettlementHistoryTitle');
});
