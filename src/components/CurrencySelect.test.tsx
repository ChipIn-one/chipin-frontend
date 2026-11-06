import { Theme } from '@radix-ui/themes';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { lightThemeStyled } from 'constants/styled-themes';
import { currencyRatesKeys } from 'entities/currency-rates';
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';

import CurrencySelect from './CurrencySelect';

import 'i18n/index';

test('uses the currencies namespace for the search placeholder', () => {
    const interaction = userEvent.setup();

    const client = createTestQueryClient();

    client.setQueryData(currencyRatesKeys.all, {
        base: 'USD',
        timestamp: 1,
        fetchedAt: 1,
        stale: false,
        rates: { USD: '1', EUR: '0.9' },
    });
    renderWithQueryClient(
        <ThemeProvider theme={lightThemeStyled}>
            <Theme>
                <CurrencySelect currency="USD" />
            </Theme>
        </ThemeProvider>,
        client,
    );

    return interaction.click(screen.getByRole('button', { name: /USD - US Dollar/i })).then(() => {
        expect(screen.getByPlaceholderText('Search currency')).not.toBeNull();
    });
});
