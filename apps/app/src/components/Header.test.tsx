import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { PROJECT_NAME } from 'constants/chipin';
import { LS_KEY_LOCALE } from 'constants/localstorage';
import { LocalStorage, saveLocalUser } from 'helpers/localStorage';
import { i18n } from 'i18n';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';

import { Header } from './Header';

import 'i18n/index';

vi.mock('@chipin/tokens/assets/logo.svg?react', () => ({
    default: () => <svg aria-hidden />,
}));
vi.mock('assets/google-icon.svg?react', () => ({
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
    saveLocalUser({ role: 'ADMIN', settings });
    useUiPrefsStore.setState({ appMode: APP_MODES.SOLO });
    LocalStorage.remove(LS_KEY_LOCALE);
    window.sessionStorage.clear();

    return i18n.changeLanguage('en');
});

test('opens the Group route when an authenticated user clicks the logo', () => {
    const interaction = userEvent.setup();

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <Theme>
                <Header />
                <LocationPath />
            </Theme>
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('link', { name: PROJECT_NAME })).then(() => {
        expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
    });
});

test('opens the Group route for a user with stale Solo state', () => {
    const interaction = userEvent.setup();

    saveLocalUser({ role: 'USER', settings });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <Theme>
                <Header />
                <LocationPath />
            </Theme>
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('link', { name: PROJECT_NAME })).then(() => {
        expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
        expect(screen.getByText('Group')).toBeTruthy();
        expect(screen.queryByText('Solo')).toBeNull();
    });
});

test('opens the Group route when the logo is clicked from another page with stale Solo state', () => {
    const interaction = userEvent.setup();

    useUiPrefsStore.setState({ appMode: APP_MODES.SOLO });
    saveLocalUser({
        role: 'ADMIN',
        settings: { ...settings, soloModeByDefault: false },
    });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <Theme>
                <Header />
                <LocationPath />
            </Theme>
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('link', { name: PROJECT_NAME })).then(() => {
        expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
    });
});

test('hides the mode badge when signed out', () => {
    useAuthStore.setState({ status: 'unauthenticated' });

    render(
        <MemoryRouter initialEntries={['/']}>
            <Theme>
                <Header />
            </Theme>
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
            <Theme>
                <Header />
            </Theme>
        </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: i18n.t('header.devMenu') })).toBeNull();
});

test('does not show a separate authenticated avatar shortcut in the global header', () => {
    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <Theme>
                <Header />
            </Theme>
        </MemoryRouter>,
    );

    // Brand link and the four normal navigation items, without an extra avatar link.
    expect(screen.getAllByRole('link')).toHaveLength(5);
});

// 04-2g: signed out the logo leads to the site origin (tests run on localhost, the development
// environment); 04-5b: the app serves no public page of its own.
test.each([
    ['/login', 'https://site-dev.chipin.one/'],
    ['/not-found', 'https://site-dev.chipin.one/'],
    ['/ru/privacy', 'https://site-dev.chipin.one/'],
])('04-2f site paths: signed out on %s the logo is a plain link to %s', (path, href) => {
    useAuthStore.setState({ status: 'unauthenticated' });

    render(
        <MemoryRouter initialEntries={[path]}>
            <Theme>
                <Header />
            </Theme>
        </MemoryRouter>,
    );

    const logo = screen.getByRole('link', { name: PROJECT_NAME });
    expect(logo.tagName).toBe('A');
    expect(logo.getAttribute('href')).toBe(href);
});

test('04-2f login: the sign-in page has no header sign-in button', () => {
    useAuthStore.setState({ status: 'unauthenticated' });

    render(
        <MemoryRouter initialEntries={['/login']}>
            <Theme>
                <Header />
            </Theme>
        </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: i18n.t('header.signIn') })).toBeNull();
});

test('signed out off the sign-in page the header sign-in opens the auth modal', () => {
    const interaction = userEvent.setup();
    useAuthStore.setState({ status: 'unauthenticated' });

    render(
        <MemoryRouter initialEntries={['/not-found']}>
            <Theme>
                <Header />
            </Theme>
        </MemoryRouter>,
    );

    return interaction
        .click(screen.getByRole('button', { name: i18n.t('header.signIn') }))
        .then(() => {
            expect(screen.getByRole('dialog')).toBeTruthy();
        });
});

// #971: signed in, a phone gets its navigation from the bottom bar, so the header hides below
// `sm`. The join pages have no bottom bar: there the header (logo link and mode badge) stays.
test.each([
    ['/group/join/AbCdEfGhIjKlMnOpQrStUvWxYz012345', false],
    ['/friends/join/AbCdEfGhIjKlMnOpQrStUvWxYz012345', false],
    ['/settings', true],
])('#971 signed in on %s the header hides below sm: %s', (path, isHiddenOnPhone) => {
    saveLocalUser({ role: 'USER', settings });

    render(
        <MemoryRouter initialEntries={[path]}>
            <Theme>
                <Header />
            </Theme>
        </MemoryRouter>,
    );

    const logo = screen.getByRole('link', { name: PROJECT_NAME });
    expect(logo.closest('.rt-r-display-none') !== null).toBe(isHiddenOnPhone);
    expect(logo.getAttribute('href')).toBe('/dashboard');
    expect(screen.getByText('Group')).toBeTruthy();
});
