import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { currencyRatesKeys, EMPTY_CURRENCY_RATES } from 'entities/currency-rates';
import { saveLocalUser } from 'helpers/localStorage';
import { getOrThrow } from 'test/getOrThrow';
import { createTestQueryClient, renderWithQueryClient } from 'test/renderWithQueryClient';

import SettingsPage from './SettingsPage';

import 'i18n/index';

// Rates already loaded: the currency picker does not request them.
const ratesClient = () => {
    const client = createTestQueryClient();

    client.setQueryData(currencyRatesKeys.all, EMPTY_CURRENCY_RATES);
    return client;
};

vi.mock('helpers/pwa', () => ({
    checkIsPwaInstalled: () => false,
}));

const SECTION_TITLES = [
    'Profile info',
    'Regional Preferences',
    'Expense Preferences',
    'App Settings',
    'Privacy & Security',
] as const;

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

const renderSettings = () => {
    renderWithQueryClient(
        <MemoryRouter>
            <ThemeProvider theme={lightThemeStyled}>
                <SettingsPage />
            </ThemeProvider>
        </MemoryRouter>,
        ratesClient(),
    );
};

test('does not render unfinished notifications settings', () => {
    saveLocalUser({ role: 'ADMIN', settings });
    renderSettings();

    const sectionTitles = SECTION_TITLES.map(title => screen.getByText(title));

    expect(screen.getByText('Your preferences.')).toBeTruthy();
    expect(screen.queryByText('Notifications')).toBeNull();
    expect(screen.queryByText('Solo Preferences')).toBeNull();

    for (let index = 1; index < sectionTitles.length; index += 1) {
        const previousTitle = getOrThrow(sectionTitles, index - 1);
        const currentTitle = getOrThrow(sectionTitles, index);

        expect(
            previousTitle.compareDocumentPosition(currentTitle) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).not.toBe(0);
    }
});

test.each(['USER', 'ADMIN'] as const)('hides Solo preferences for a $role user', role => {
    saveLocalUser({ role, settings });

    renderSettings();

    expect(screen.queryByText('Solo Preferences')).toBeNull();
});
