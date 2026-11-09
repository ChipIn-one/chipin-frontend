import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { saveLocalUser } from 'helpers/localStorage';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';

import HeaderNav from './HeaderNav';

import 'i18n/index';

const LocationPath = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
};

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
    saveLocalUser({ role: 'ADMIN', settings });
});

test.each([
    { appMode: APP_MODES.SOLO, expectedRoute: '/dashboard' },
    { appMode: APP_MODES.GROUP, expectedRoute: '/dashboard' },
])('opens $expectedRoute from the home link in $appMode mode', ({ appMode, expectedRoute }) => {
    const interaction = userEvent.setup();
    useUiPrefsStore.setState({ appMode });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ThemeProvider theme={lightThemeStyled}>
                <HeaderNav />
                <LocationPath />
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('link', { name: 'Dashboard' })).then(() => {
        expect(screen.getByLabelText('Current route').textContent).toBe(expectedRoute);
    });
});
