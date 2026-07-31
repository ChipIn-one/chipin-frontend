import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { lightThemeStyled } from 'constants/styled-themes';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';

import MobileNavBar from './MobileNavBar';

import 'i18n/index';

const LocationPath = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
};

test.each([
    { appMode: APP_MODES.SOLO, expectedRoute: '/solo' },
    { appMode: APP_MODES.GROUP, expectedRoute: '/dashboard' },
])('opens $expectedRoute from the home link in $appMode mode', ({ appMode, expectedRoute }) => {
    const interaction = userEvent.setup();
    useDashboardStore.setState({ appMode });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ThemeProvider theme={lightThemeStyled}>
                <MobileNavBar />
                <LocationPath />
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('link', { name: 'Dashboard' })).then(() => {
        expect(screen.getByLabelText('Current route').textContent).toBe(expectedRoute);
    });
});
