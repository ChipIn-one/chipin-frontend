import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { UserSettings } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { useUsersStore } from 'store/users-store';

import SettingsPage from './SettingsPage';

import 'i18n/index';

vi.mock('helpers/pwa', () => ({
    checkIsPwaInstalled: () => false,
}));

const SECTION_TITLES = [
    'Profile info',
    'Regional Preferences',
    'Expense Preferences',
    'Solo Preferences',
    'Notifications',
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
    render(
        <MemoryRouter>
            <ThemeProvider theme={lightThemeStyled}>
                <SettingsPage />
            </ThemeProvider>
        </MemoryRouter>,
    );
};

test('renders notifications and app settings immediately before privacy and security', () => {
    useUsersStore.setState({ user: null, localUser: { role: 'ADMIN', settings }, friends: [] });
    renderSettings();

    const sectionTitles = SECTION_TITLES.map(title => screen.getByText(title));

    expect(screen.getByText('Your preferences.')).toBeTruthy();

    for (let index = 1; index < sectionTitles.length; index += 1) {
        const previousTitle = sectionTitles[index - 1];
        const currentTitle = sectionTitles[index];

        expect(
            previousTitle.compareDocumentPosition(currentTitle) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).not.toBe(0);
    }
});

test('hides Solo preferences for a non-admin user', () => {
    useUsersStore.setState({ user: null, localUser: { role: 'USER', settings }, friends: [] });

    renderSettings();

    expect(screen.queryByText('Solo Preferences')).toBeNull();
});
