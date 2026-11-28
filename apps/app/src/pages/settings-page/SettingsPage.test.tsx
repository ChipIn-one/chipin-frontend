import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
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
            <SettingsPage />
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

// Issue #929: the page title was wrapped in `display={{ initial: 'block', lg: 'none' }}`, so wide
// screens had no title. Radix renders a hidden breakpoint as a `<bp>:rt-r-display-none` class.
test('renders the Settings heading once, not hidden at any breakpoint', () => {
    saveLocalUser({ role: 'USER', settings });
    renderSettings();

    // The self user is not fetched here: the title text sits in an aria-hidden skeleton, so the
    // heading is matched by its level and text, not by its accessible name.
    const heading = screen.getByRole('heading', { level: 1 });

    expect(heading.textContent).toBe('Settings');
    expect(screen.getAllByText('Settings')).toHaveLength(1);
    for (let node = heading.parentElement; node; node = node.parentElement) {
        expect(node.className).not.toMatch(/rt-r-display-none/);
    }
});
