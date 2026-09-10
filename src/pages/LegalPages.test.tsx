import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { UserSettings } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/users-store';

import PrivacyPage from './PrivacyPage';
import TermsPage from './TermsPage';

import 'i18n/index';

vi.mock('assets/logo.svg?react', () => ({
    default: () => <svg aria-hidden />,
}));

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
    useAuthStore.setState({ status: 'authenticated' });
    useUsersStore.setState({
        user: null,
        localUser: { role: 'ADMIN', settings },
        friends: [],
    });
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
});

test.each([
    { route: ROUTES.PRIVACY, Page: PrivacyPage },
    { route: ROUTES.TERMS, Page: TermsPage },
])('keeps mobile navigation available for an authenticated user on $route', ({ route, Page }) => {
    render(
        <MemoryRouter initialEntries={[route]}>
            <ThemeProvider theme={lightThemeStyled}>
                <Page />
            </ThemeProvider>
        </MemoryRouter>,
    );

    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
    const mobileNavigation = dashboardLink.closest('.rt-r-display-block');

    expect(mobileNavigation).toBeTruthy();
    expect(mobileNavigation?.classList.contains('sm:rt-r-display-none')).toBe(true);
});
