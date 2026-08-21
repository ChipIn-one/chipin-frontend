import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render } from '@testing-library/react';

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
        render(
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <DashboardSummary />
                </Theme>
            </ThemeProvider>,
        );
    }).not.toThrow();
});
