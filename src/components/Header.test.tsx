import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UserSettings } from 'api/chipin.types';
import { PROJECT_NAME } from 'constants/chipin';
import { LS_KEY_LOCALE } from 'constants/localstorage';
import { lightThemeStyled } from 'constants/styled-themes';
import { LocalStorage } from 'helpers/localStorage';
import { isPublicLocaleSuggestionSuppressed } from 'helpers/publicLocaleSuggestion';
import i18n from 'i18n';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/users-store';

import Header from './Header';

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
    soloModeByDefault: true,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} satisfies UserSettings;

const LocationPath = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
};

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useUsersStore.setState({
        user: null,
        localUser: { role: 'ADMIN', settings },
        friends: [],
    });
    useDashboardStore.setState({ appMode: APP_MODES.SOLO });
    LocalStorage.remove(LS_KEY_LOCALE);
    window.sessionStorage.clear();

    return i18n.changeLanguage('en');
});

test('opens the Group route when an authenticated user clicks the logo', () => {
    const interaction = userEvent.setup();

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                    <LocationPath />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction
        .click(screen.getByRole('link', { name: PROJECT_NAME }))
        .then(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
        });
});

test('opens the Group route for a user with stale Solo state', () => {
    const interaction = userEvent.setup();

    useUsersStore.setState({
        user: null,
        localUser: { role: 'USER', settings },
        friends: [],
    });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                    <LocationPath />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction
        .click(screen.getByRole('link', { name: PROJECT_NAME }))
        .then(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
            expect(screen.getByText('Group')).toBeTruthy();
            expect(screen.queryByText('Solo')).toBeNull();
        });
});

test('opens the Group route when the logo is clicked from another page with stale Solo state', () => {
    const interaction = userEvent.setup();

    useDashboardStore.setState({ appMode: APP_MODES.SOLO });
    useUsersStore.setState({
        localUser: {
            role: 'ADMIN',
            settings: { ...settings, soloModeByDefault: false },
        },
    });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                    <LocationPath />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction
        .click(screen.getByRole('link', { name: PROJECT_NAME }))
        .then(() => {
            expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
        });
});

test('hides the mode badge on the landing page', () => {
    useAuthStore.setState({ status: 'unauthenticated' });

    render(
        <MemoryRouter initialEntries={['/']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.getByText(PROJECT_NAME)).toBeTruthy();
    expect(screen.queryByText('Group')).toBeNull();
    expect(screen.queryByText('Solo')).toBeNull();
});

test('hides the dev menu after authentication ends even with a cached admin role', () => {
    useAuthStore.setState({ status: 'unauthenticated' });

    render(
        <MemoryRouter initialEntries={['/']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(
        screen.queryByRole('button', { name: i18n.t('header.devMenu') }),
    ).toBeNull();
});


test('manual public language selection does not change SSG content or persist language', () => {
    const interaction = userEvent.setup();
    useAuthStore.setState({ status: 'unauthenticated' });

    render(
        <MemoryRouter initialEntries={['/']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction
        .click(screen.getByRole('button', { name: 'Interface language' }))
        .then(() => interaction.click(screen.getByRole('link', { name: 'Russian' })))
        .then(() => {
            expect(LocalStorage.get(LS_KEY_LOCALE, '')).toBe('');
            expect(i18n.language).toBe('en');
            expect(isPublicLocaleSuggestionSuppressed()).toBe(true);
        });
});

test('does not show a separate authenticated avatar shortcut in the global header', () => {
    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    // Brand link and the four normal navigation items, without an extra avatar link.
    expect(screen.getAllByRole('link')).toHaveLength(5);
});

test('public legal pages expose equivalent language URLs in the search dropdown', () => {
    const interaction = userEvent.setup();
    useAuthStore.setState({ status: 'unauthenticated' });

    render(
        <MemoryRouter initialEntries={['/privacy']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('button', { name: 'Interface language' })).then(() => {
        expect(screen.getByRole('link', { name: 'English' }).getAttribute('href')).toBe('/privacy');
        expect(screen.getByRole('link', { name: 'Russian' }).getAttribute('href')).toBe('/ru/privacy');
    });
});
