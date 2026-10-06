import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

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

const renderSummary = (hasGroups = false) =>
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <Theme>
                <DashboardSummary hasGroups={hasGroups} />
            </Theme>
        </ThemeProvider>,
    );

beforeEach(() => {
    useUsersStore.setState({
        user: null,
        localUser: { role: 'USER', settings },
    });
    useDashboardStore.setState({
        balances: {},
        currencies: {
            base: 'USD',
            timestamp: 1,
            fetchedAt: 1,
            stale: false,
            rates: { USD: 1 },
        },
    });
});

test('renders a confirmed non-zero summary without entering a store snapshot update loop', () => {
    useDashboardStore.setState({
        balances: {
            USD: { currency: 'USD', netBalance: 25 },
        },
    });

    expect(() => {
        renderSummary();
    }).not.toThrow();

    expect(screen.getByText('Total balance')).toBeTruthy();
});

test('hides zero Total balance and settled state when no groups exist', () => {
    renderSummary(false);

    expect(screen.queryByText('Total balance')).toBeNull();
    expect(screen.queryByText('All settled')).toBeNull();
});

test('shows concise All settled state for a zero summary when a group exists', () => {
    renderSummary(true);

    expect(screen.queryByText('Total balance')).toBeNull();
    expect(screen.getByText('All settled')).toBeTruthy();
    expect(
        screen.getByText('Nothing to settle right now.'),
    ).toBeTruthy();
});
