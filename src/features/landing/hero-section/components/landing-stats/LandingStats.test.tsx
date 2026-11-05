import { StrictMode } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { statsKeys } from 'entities/stats';
import { setupMswServer } from 'test/mswServer';
import { renderWithQueryClient } from 'test/renderWithQueryClient';

import LandingStats from './LandingStats';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        i18n: {
            language: 'en',
            resolvedLanguage: 'en-US',
        },
        t: (key: string) => key,
    }),
}));

const server = setupMswServer();

const STATS_URL = '*/stats';

const respondWithStats = (stats: Record<string, number>) => {
    const requests: Request[] = [];

    server.use(
        http.get(STATS_URL, ({ request }) => {
            requests.push(request);
            return HttpResponse.json(stats);
        }),
    );
    return requests;
};

const region = () => screen.getByRole('region', { name: 'stats.regionLabel' });

test('maps every response field to its corresponding landing metric', async () => {
    respondWithStats({
        usersCount: 1_200,
        expensesCount: 2_300_000,
        groupsCount: 34_000,
        settlementsCount: 456_000,
    });

    renderWithQueryClient(<LandingStats />);

    expect(
        await within(screen.getByRole('group', { name: 'stats.totalUsers' })).findByText('1.20K'),
    ).toBeTruthy();
    expect(
        within(screen.getByRole('group', { name: 'stats.expensesTracked' })).getByText('2.30M'),
    ).toBeTruthy();
    expect(
        within(screen.getByRole('group', { name: 'stats.groupsCreated' })).getByText('34.00K'),
    ).toBeTruthy();
    expect(
        within(screen.getByRole('group', { name: 'stats.settlementsRecorded' })).getByText(
            '456.00K',
        ),
    ).toBeTruthy();
    expect(screen.queryByText('stats.userRating')).toBeNull();
});

test('renders zero values as zero', async () => {
    respondWithStats({ usersCount: 0, expensesCount: 0, groupsCount: 0, settlementsCount: 0 });

    renderWithQueryClient(<LandingStats />);

    await waitFor(() => expect(screen.getAllByText('0')).toHaveLength(4));
});

test('keeps the minus sign for non-monetary landing statistics', async () => {
    respondWithStats({
        usersCount: -1_200,
        expensesCount: 2_300_000,
        groupsCount: 34_000,
        settlementsCount: 456_000,
    });

    renderWithQueryClient(<LandingStats />);

    expect(
        await within(screen.getByRole('group', { name: 'stats.totalUsers' })).findByText('-1,200'),
    ).toBeTruthy();
});

test('keeps all metric blocks rendered while loading', () => {
    server.use(
        http.get(STATS_URL, async () => {
            await delay('infinite');
            return HttpResponse.json({});
        }),
    );

    renderWithQueryClient(<LandingStats />);

    expect(region().getAttribute('aria-busy')).toBe('true');
    expect(within(region()).getAllByRole('group')).toHaveLength(4);
    expect(region().querySelectorAll('[inert]')).toHaveLength(12);
});

test('shows a safe value in every metric block after failure', async () => {
    server.use(
        http.get(STATS_URL, () => HttpResponse.json({ code: 'SYSTEM.INTERNAL' }, { status: 500 })),
    );

    renderWithQueryClient(<LandingStats />);

    await waitFor(() => expect(within(region()).getAllByText('—')).toHaveLength(4));
    expect(region().getAttribute('aria-busy')).toBe('false');
});

test('keeps cached statistics visible while a refetch fails', async () => {
    respondWithStats({
        usersCount: 1_200,
        expensesCount: 2_300_000,
        groupsCount: 34_000,
        settlementsCount: 456_000,
    });

    const { client } = renderWithQueryClient(<LandingStats />);

    await screen.findByText('1.20K');
    server.use(
        http.get(STATS_URL, () => HttpResponse.json({ code: 'SYSTEM.INTERNAL' }, { status: 500 })),
    );
    await client.refetchQueries({ queryKey: statsKeys.all });

    expect(client.getQueryState(statsKeys.all)?.status).toBe('error');
    expect(region().getAttribute('aria-busy')).toBe('false');
    expect(within(region()).getByText('1.20K')).toBeTruthy();
    expect(within(region()).queryByText('—')).toBeNull();
});

test('requests the statistics once when mounted in Strict Mode', async () => {
    const requests = respondWithStats({
        usersCount: 1_200,
        expensesCount: 2_300_000,
        groupsCount: 34_000,
        settlementsCount: 456_000,
    });

    renderWithQueryClient(
        <StrictMode>
            <LandingStats />
        </StrictMode>,
    );

    await screen.findByText('1.20K');
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]?.url ?? '').pathname).toMatch(/\/stats$/);
    expect(requests[0]?.headers.get('Authorization')).toBeNull();
});
