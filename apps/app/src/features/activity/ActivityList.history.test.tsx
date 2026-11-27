// Issue #705: an Activity page row opens the history of its expense or settlement chain, the same
// view (`/activity/:parentActivityId`) the group page and the Dashboard rows open.
import { Theme } from '@radix-ui/themes';
import type { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { lightThemeStyled } from 'constants/styled-themes';
import type { ActivityEvent, SelfActivityEventsData } from 'entities/activity';
import { activityKeys } from 'entities/activity';
import { currencyCode, fromUnits } from 'shared/money';
import { useAuthStore } from 'store/authStore';
import { domainPreview } from 'test/activityFixtures';
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import { ActivityList } from './ActivityList';

import 'i18n/index';

vi.mock('hooks/useInfiniteScroll', () => ({
    useInfiniteScroll: () => vi.fn(),
}));

const FEED_KEY = activityKeys.self({ view: 'events' });

const created = (id: string): ActivityEvent => domainPreview(id).parent;
// A later event of the chain `id`: its own id, linked to the chain's creation event.
const updated = (id: string): ActivityEvent =>
    domainPreview(id, { seq: 2, lastAction: 'EXPENSE_UPDATED' }).lastEvent;
const reversed = (id: string): ActivityEvent =>
    domainPreview(id, { seq: 3, lastAction: 'EXPENSE_REVERSED' }).lastEvent;
const settlement = (id: string): ActivityEvent => ({
    ...created(id),
    action: 'SETTLEMENT_CREATED',
    subjectType: 'settlement',
    metadata: {
        type: 'settlement',
        entryId: `entry-${id}`,
        amount: fromUnits(50_000n, currencyCode('USD')),
        fromDisplayName: 'Member',
        toDisplayName: 'Owner',
    },
});

let client: QueryClient;

beforeEach(() => {
    client = createTestQueryClient();
    mountAsUserClient('user-1', client);
    useAuthStore.setState({ status: 'authenticated' });
});

const HistoryProbe = () => {
    const { parentActivityId } = useParams<{ parentActivityId: string }>();

    return <div data-testid="history-page">{parentActivityId}</div>;
};

const renderActivityPage = (items: ActivityEvent[]) => {
    client.setQueryData<SelfActivityEventsData>(FEED_KEY, {
        pages: [{ items, nextCursor: null }],
        pageParams: [null],
    });

    return renderWithQueryClient(
        <ThemeProvider theme={lightThemeStyled}>
            <Theme>
                <MemoryRouter initialEntries={['/activity']}>
                    <Routes>
                        <Route
                            path="/activity"
                            element={<ActivityList activeFilter="all" onShowAll={vi.fn()} />}
                        />
                        <Route path="/activity/:parentActivityId" element={<HistoryProbe />} />
                    </Routes>
                </MemoryRouter>
            </Theme>
        </ThemeProvider>,
        client,
    );
};

test('ACT-020/ACT-025 clicking an expense row of the Activity page opens its history', async () => {
    renderActivityPage([created('expense-1')]);

    await userEvent.click(screen.getByRole('link', { name: /Expense expense-1/ }));

    expect(screen.getByTestId('history-page').textContent).toBe('expense-1');
});

test('ACT-005/ACT-025 a later event of a chain opens the history of the chain, not of the event', async () => {
    renderActivityPage([updated('expense-1')]);

    await userEvent.click(screen.getByRole('link', { name: /Expense expense-1/ }));

    expect(screen.getByTestId('history-page').textContent).toBe('expense-1');
});

test('ACT-020/ACT-025 a settlement row of the Activity page opens its history', async () => {
    renderActivityPage([settlement('settlement-1')]);

    await userEvent.click(screen.getByRole('link', { name: /Member/ }));

    expect(screen.getByTestId('history-page').textContent).toBe('settlement-1');
});

test('#705 a row is reached with Tab and opened with Enter; its name is translated text', async () => {
    renderActivityPage([created('expense-1')]);

    await userEvent.tab();
    // The name is the card's text: the description and the translated "... paid" line.
    const row = screen.getByRole('link', { name: /Expense expense-1.*Owner paid/ });

    expect(document.activeElement).toBe(row);

    await userEvent.keyboard('{Enter}');

    expect(screen.getByTestId('history-page').textContent).toBe('expense-1');
});

test('ACT-020 a deletion (reversal) row stays a plain card on the Activity page, as before this change', () => {
    renderActivityPage([reversed('expense-1')]);

    expect(screen.getByText('Expense expense-1')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
});
