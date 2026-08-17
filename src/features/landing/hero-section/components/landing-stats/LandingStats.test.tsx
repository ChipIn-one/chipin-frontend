import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, within } from '@testing-library/react';

import { useLandingStatsStore } from 'store/landing-stats-store';
import { useLoadingStore } from 'store/loadingStore';

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

beforeEach(() => {
    useLandingStatsStore.getState().setInitialLandingStatsStore();
    useLoadingStore.getState().setInitialLoadingStore();
});

test('maps every response field to its corresponding landing metric', () => {
    useLandingStatsStore.setState({
        stats: {
            usersCount: 1_200,
            expensesCount: 2_300_000,
            groupsCount: 34_000,
            settlementsCount: 456_000,
        },
    });
    useLoadingStore.getState().setLoading('landing', 'stats', 'fetched');

    render(<LandingStats />);

    expect(
        within(screen.getByRole('group', { name: 'stats.totalUsers' })).getByText('1.20K'),
    ).toBeTruthy();
    expect(
        within(screen.getByRole('group', { name: 'stats.expensesTracked' })).getByText('2.30M'),
    ).toBeTruthy();
    expect(
        within(screen.getByRole('group', { name: 'stats.groupsCreated' })).getByText('34.00K'),
    ).toBeTruthy();
    expect(
        within(screen.getByRole('group', { name: 'stats.settlementsRecorded' })).getByText('456.00K'),
    ).toBeTruthy();
    expect(screen.queryByText('stats.userRating')).toBeNull();
});

test('renders zero values as zero', () => {
    useLandingStatsStore.setState({
        stats: {
            usersCount: 0,
            expensesCount: 0,
            groupsCount: 0,
            settlementsCount: 0,
        },
    });
    useLoadingStore.getState().setLoading('landing', 'stats', 'fetched');

    render(<LandingStats />);

    expect(screen.getAllByText('0')).toHaveLength(4);
});

test('keeps all metric blocks rendered while loading', () => {
    useLoadingStore.getState().setLoading('landing', 'stats', 'loading');

    render(<LandingStats />);

    const region = screen.getByRole('region', { name: 'stats.regionLabel' });

    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(within(region).getAllByRole('group')).toHaveLength(4);
    expect(region.querySelectorAll('[inert]')).toHaveLength(12);
});

test('shows a safe value in every metric block after failure', () => {
    useLandingStatsStore.setState({ stats: null });
    useLoadingStore.getState().setLoading('landing', 'stats', 'fetched');

    render(<LandingStats />);

    const region = screen.getByRole('region', { name: 'stats.regionLabel' });

    expect(region.getAttribute('aria-busy')).toBe('false');
    expect(within(region).getAllByText('—')).toHaveLength(4);
});

test('keeps cached statistics visible after the global loading store resets', () => {
    useLandingStatsStore.setState({
        stats: {
            usersCount: 1_200,
            expensesCount: 2_300_000,
            groupsCount: 34_000,
            settlementsCount: 456_000,
        },
    });
    useLoadingStore.getState().setInitialLoadingStore();

    render(<LandingStats />);

    const region = screen.getByRole('region', { name: 'stats.regionLabel' });

    expect(region.getAttribute('aria-busy')).toBe('false');
    expect(within(region).getByText('1.20K')).toBeTruthy();
    expect(region.querySelector('[inert]')).toBeNull();
});
