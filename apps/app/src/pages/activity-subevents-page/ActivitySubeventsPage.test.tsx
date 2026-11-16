import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';
import { useAuthStore } from 'store/authStore';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

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
    ActivitySubeventsHeader: ({ isUnavailable }: { isUnavailable: boolean }) =>
        isUnavailable ? (
            <span data-testid="parent-unavailable" />
        ) : (
            <span data-testid="subevents-header" />
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

const server = setupMswServer();

afterEach(() => {
    useAuthStore.setState({ status: 'unknown' });
});

// Signed in on the user's client; the history of `activity-1` answers with `parentEvent`, or 404
// (`ACTIVITY.NOT_FOUND`) without one. `requests` lists the query of every history read.
const renderPage = (parentEvent: AppEvent | null) => {
    const requests: string[] = [];

    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    mountAsUserClient();
    server.use(
        http.get('*/users/self/activities/:parentActivityId/children', ({ request, params }) => {
            requests.push(`${String(params.parentActivityId)}${new URL(request.url).search}`);
            return parentEvent
                ? HttpResponse.json({ parent: parentEvent, items: [], nextCursor: null })
                : HttpResponse.json({ code: 'ACTIVITY.NOT_FOUND' }, { status: 404 });
        }),
    );

    const view = render(
        <MemoryRouter initialEntries={['/activity/activity-1']}>
            <Routes>
                <Route path="/activity/:parentActivityId" element={<ActivitySubeventsPage />} />
            </Routes>
        </MemoryRouter>,
    );

    return { ...view, requests };
};

test('ACT-025 a direct visit reads the history once, without a category filter', async () => {
    const { requests } = renderPage(expenseParentEvent);

    await screen.findByTestId('page-breadcrumb');
    expect(requests).toEqual(['activity-1?limit=20']);
});

test('shows a parent fallback when the chain is not found, and still shows the feed', async () => {
    renderPage(null);

    expect(await screen.findByTestId('parent-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('subevents-details')).toBeTruthy();
    expect(screen.getByTestId('subevents-feed')).toBeTruthy();
    expect(screen.queryByTestId('page-breadcrumb')).toBeNull();
});

test('renders the expense breadcrumb before the details column', async () => {
    renderPage(expenseParentEvent);

    const breadcrumb = await screen.findByTestId('page-breadcrumb');
    const details = screen.getByTestId('subevents-details');

    expect(breadcrumb.textContent).toBe('subeventsExpenseHistoryTitle');
    expect(breadcrumb.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
        0,
    );
});

test('preserves the settlement breadcrumb title', async () => {
    renderPage(settlementParentEvent);

    expect((await screen.findByTestId('page-breadcrumb')).textContent).toBe(
        'subeventsSettlementHistoryTitle',
    );
});
