import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { lightThemeStyled } from 'constants/styled-themes';
import { useDashboardStore } from 'store/dashboardStore';

import CurrencySelect from './CurrencySelect';

import 'i18n/index';

test('uses the currencies namespace for the search placeholder', () => {
    const interaction = userEvent.setup();

    useDashboardStore.setState(state => ({
        ...state,
        currencies: {
            base: 'USD',
            timestamp: 1,
            fetchedAt: 1,
            stale: false,
            rates: { USD: 1, EUR: 0.9 },
        },
    }));

    render(
        <ThemeProvider theme={lightThemeStyled}>
            <Theme>
                <CurrencySelect currency="USD" />
            </Theme>
        </ThemeProvider>,
    );

    return interaction
        .click(screen.getByRole('button', { name: /USD - US Dollar/i }))
        .then(() => {
            expect(screen.getByPlaceholderText('Search currency')).not.toBeNull();
        });
});
