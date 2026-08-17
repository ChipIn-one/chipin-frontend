import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { lightThemeStyled } from 'constants/styled-themes';

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

test('renders notifications and app settings immediately before privacy and security', () => {
    render(
        <MemoryRouter>
            <ThemeProvider theme={lightThemeStyled}>
                <SettingsPage />
            </ThemeProvider>
        </MemoryRouter>,
    );

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
