import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { fireEvent, render, screen } from '@testing-library/react';

import type { UserSettings } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/users-store';

import DashboardSummary from './DashboardSummary';

import 'i18n/index';

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'system',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies UserSettings;

const renderSummary = (isLoading = false) =>
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <Theme>
                <DashboardSummary isLoading={isLoading} />
            </Theme>
        </ThemeProvider>,
    );

beforeEach(() => {
    useUsersStore.setState({
        user: null,
        localUser: { role: 'USER', settings },
    });
    useDashboardStore.setState({
        balances: {
            USD: { currency: 'USD', netBalance: 25 },
        },
        currencies: {
            base: 'USD',
            timestamp: 1,
            fetchedAt: 1,
            stale: false,
            rates: { USD: 1 },
        },
    });
});

test('renders a confirmed summary without entering a store snapshot update loop', () => {
    expect(() => {
        renderSummary();
    }).not.toThrow();
});

test('uses one outer skeleton for the whole summary card while loading', () => {
    const { container } = renderSummary(true);

    expect(container.querySelectorAll('.rt-Skeleton')).toHaveLength(1);
    expect(container.querySelector('.rt-Skeleton.rt-Card')).toBeTruthy();
});

test('keeps per-currency balances collapsed until the summary is expanded', () => {
    useDashboardStore.setState({
        balances: {
            USD: { currency: 'USD', netBalance: 25 },
            EUR: { currency: 'EUR', netBalance: -10 },
        },
        currencies: {
            base: 'USD',
            timestamp: 1,
            fetchedAt: 1,
            stale: false,
            rates: { USD: 1, EUR: 2 },
        },
    });

    renderSummary();

    expect(screen.queryByText('10 EUR')).toBeNull();

    const toggle = screen.getByRole('button', { name: /Show balance details/ });

    expect(toggle.querySelector('.lucide-trending-up')).toBeNull();
    expect(toggle.querySelector('.lucide-trending-down')).toBeNull();
    expect(toggle.classList.contains('rt-Card')).toBe(true);
    expect(toggle.querySelector('.rt-Card')).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).not.toContain('Owed to you');
    expect(toggle.textContent).not.toContain('You owe');
    expect(screen.getByText('10 EUR')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Hide balance details/ })).toBeTruthy();
});

test('does not render zero-value debt directions or an empty details toggle', () => {
    useDashboardStore.setState({
        balances: {
            USD: { currency: 'USD', netBalance: 0 },
        },
    });

    renderSummary();

    expect(screen.queryByText('Owed to you')).toBeNull();
    expect(screen.queryByText('You owe')).toBeNull();
    expect(screen.queryByRole('button', { name: /Show balance details/ })).toBeNull();
});

test('starts collapsed again after the Dashboard summary remounts', () => {
    const firstRender = renderSummary();
    const toggle = screen.getByRole('button', { name: /Show balance details/ });

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    firstRender.unmount();
    renderSummary();

    expect(
        screen.getByRole('button', { name: /Show balance details/ }).getAttribute('aria-expanded'),
    ).toBe('false');
});
