import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { SITE_PAGE_PATHS } from 'constants/sitePaths';
import { lightThemeStyled } from 'constants/styled-themes';
import { saveLocalUser } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';

import PrivacyPage from './PrivacyPage';
import TermsPage from './TermsPage';

import 'i18n/index';

vi.mock('@chipin/tokens/assets/logo.svg?react', () => ({
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
    saveLocalUser({ role: 'ADMIN', settings });
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });
});

test.each([
    { route: SITE_PAGE_PATHS.privacy, Page: PrivacyPage },
    { route: SITE_PAGE_PATHS.terms, Page: TermsPage },
])('keeps mobile navigation available for an authenticated user on $route', ({ route, Page }) => {
    render(
        <MemoryRouter initialEntries={[route]}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Page />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });

    expect(dashboardLink).toBeTruthy();
});

test.each([
    { route: SITE_PAGE_PATHS.privacy, Page: PrivacyPage },
    { route: SITE_PAGE_PATHS.terms, Page: TermsPage },
])('reserves bottom space for the fixed mobile navigation on $route', ({ route, Page }) => {
    render(
        <MemoryRouter initialEntries={[route]}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Page />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    const legalPageFooter = screen.getByTestId('legal-page-footer');

    expect(getComputedStyle(legalPageFooter).paddingBottom).not.toBe('0px');
});

test('discloses Google user data use and a privacy contact on the privacy page', () => {
    render(
        <MemoryRouter initialEntries={[SITE_PAGE_PATHS.privacy]}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <PrivacyPage />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    const googleSignInHeading = screen.getByRole('heading', { name: 'Google Sign-In' });
    const contactLink = screen.getByRole('link', { name: 'privacy@chipin.one' });

    expect(googleSignInHeading).toBeTruthy();
    expect(contactLink.getAttribute('href')).toBe('mailto:privacy@chipin.one');
});
