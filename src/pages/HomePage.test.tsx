import { StrictMode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';

import { useLandingStatsStore } from 'store/landing-stats-store';

import HomePage from './HomePage';

const { fetchStatsMock } = vi.hoisted(() => ({
    fetchStatsMock: vi.fn(),
}));

vi.mock('api/statsApi', () => ({ fetchStats: fetchStatsMock }));

vi.mock('features/landing', () => ({
    CtaSection: () => <section aria-label="CTA" />,
    FeaturesSection: () => <section aria-label="Features" />,
    HeroSection: () => <section aria-label="Hero" />,
    HowItWorksSection: () => <section aria-label="How it works" />,
    ShowcaseSections: () => <section aria-label="Showcase" />,
}));

vi.mock('components/Footer', () => ({ default: () => <footer aria-label="Footer" /> }));

beforeEach(() => {
    vi.clearAllMocks();
    useLandingStatsStore.getState().setInitialLandingStatsStore();
});

test('loads public statistics once when the landing page mounts in Strict Mode', () => {
    fetchStatsMock.mockResolvedValue({
        usersCount: 51_234,
        groupsCount: 16_789,
        expensesCount: 25_345_678,
        settlementsCount: 321_987,
    });

    render(
        <StrictMode>
            <HomePage />
        </StrictMode>,
    );

    return waitFor(() => {
        expect(fetchStatsMock).toHaveBeenCalledOnce();
        expect(useLandingStatsStore.getState().stats).toEqual({
            usersCount: 51_234,
            groupsCount: 16_789,
            expensesCount: 25_345_678,
            settlementsCount: 321_987,
        });
    });
});

test('keeps every landing section and footer in the intended order', () => {
    fetchStatsMock.mockResolvedValue({
        usersCount: 51_234,
        groupsCount: 16_789,
        expensesCount: 25_345_678,
        settlementsCount: 321_987,
    });

    render(<HomePage />);

    const sectionLabels = screen
        .getAllByRole('region')
        .map(section => section.getAttribute('aria-label'));

    expect(sectionLabels).toEqual(['Hero', 'Features', 'Showcase', 'How it works', 'CTA']);
    expect(screen.getByRole('contentinfo', { name: 'Footer' })).toBeTruthy();
});
