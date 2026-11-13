// The Activity page's filter with the real `useInfiniteScroll`: the trigger stays in view while a
// filter matches few of the loaded events, so the feed keeps loading.
import { Theme } from '@radix-ui/themes';
import { act, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { ActivityEvent } from 'entities/activity';
import { useAuthStore } from 'store/authStore';
import { wirePreview } from 'test/activityFixtures';
import { setupMswServer } from 'test/mswServer';
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';
import { mountAsUserClient } from 'test/userClient';

import ActivityList from './ActivityList';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('components/skeletons', () => ({
    ActivityFeedSkeleton: () => <div data-testid="activity-skeleton" />,
}));

vi.mock('./components', () => ({
    ActivityEventsList: ({ log }: { log: readonly ActivityEvent[] }) => (
        <ul>
            {log.map(event => (
                <li key={event.id} data-testid="event">
                    {event.id}
                </li>
            ))}
        </ul>
    ),
}));

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;

// The scroll trigger (the sentinel under the list) as the browser reports it.
const sentinel = { isIntersecting: true, report: [] as ObserverCallback[] };

class IntersectionObserverMock {
    private readonly callback: ObserverCallback;

    constructor(callback: ObserverCallback) {
        this.callback = callback;
        sentinel.report.push(callback);
    }

    observe(target: Element): void {
        this.callback([
            { isIntersecting: sentinel.isIntersecting, target } as IntersectionObserverEntry,
        ]);
    }

    disconnect(): void {
        sentinel.report = sentinel.report.filter(callback => callback !== this.callback);
    }
}

const server = setupMswServer();

beforeEach(() => {
    sentinel.isIntersecting = true;
    sentinel.report = [];
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    useAuthStore.setState({ status: 'authenticated' });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// Three pages of expenses; only the last one carries a settlement.
const wireExpense = (id: string) => wirePreview(id).parent;
const wireSettlement = (id: string) => ({
    ...wireExpense(id),
    action: 'SETTLEMENT_CREATED',
    subjectType: 'settlement',
    metadata: {
        type: 'settlement',
        entryId: `entry-${id}`,
        amount: 5,
        currency: 'USD',
        fromDisplayName: 'Member',
        toDisplayName: 'Owner',
    },
});

const PAGES: Record<string, object> = {
    first: { items: [wireExpense('e1'), wireExpense('e2')], nextCursor: 40 },
    '40': { items: [wireExpense('e3')], nextCursor: 30 },
    '30': { items: [wireExpense('e4'), wireSettlement('s1')], nextCursor: 20 },
    '20': { items: [wireExpense('e5')], nextCursor: null },
};

const serveFeed = (onRequest: (cursor: string | null) => void = () => undefined) => {
    const cursors: (string | null)[] = [];

    server.use(
        http.get('*/users/self/activities', async ({ request }) => {
            const cursor = new URL(request.url).searchParams.get('cursor');

            cursors.push(cursor);
            onRequest(cursor);
            // As a network does: the page shows its loading state before the answer arrives.
            await delay(10);
            return HttpResponse.json(PAGES[cursor ?? 'first']);
        }),
    );
    return cursors;
};

const renderSettlements = () => {
    const client = createTestQueryClient();

    mountAsUserClient('user-1', client);
    return renderWithQueryClient(
        <Theme>
            <ActivityList activeFilter="settlements" />
        </Theme>,
        client,
    );
};

const shownEvents = () => screen.queryAllByTestId('event').map(item => item.textContent);

test('a filter matching few events keeps loading while the trigger is in view, to the end of the feed', async () => {
    const cursors = serveFeed();

    renderSettlements();

    await waitFor(() => {
        expect(screen.getByText('endOfFeed')).toBeTruthy();
    });
    // One request per page, each cursor once.
    expect(cursors).toEqual([null, '40', '30', '20']);
    expect(shownEvents()).toEqual(['s1']);
});

test('the filter stops loading once the matching rows push the trigger out of view', async () => {
    // The rows of the page with the settlement fill the screen: while that page loads, the
    // browser reports the trigger out of view.
    const cursors = serveFeed(cursor => {
        if (cursor === '30') {
            act(() => {
                sentinel.isIntersecting = false;
                sentinel.report.forEach(report => {
                    report([{ isIntersecting: false } as IntersectionObserverEntry]);
                });
            });
        }
    });

    renderSettlements();

    await waitFor(() => {
        expect(shownEvents()).toEqual(['s1']);
    });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(cursors).toEqual([null, '40', '30']);
    expect(screen.queryByText('endOfFeed')).toBeNull();
});
