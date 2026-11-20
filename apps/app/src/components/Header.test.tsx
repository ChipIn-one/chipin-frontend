import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { PROJECT_NAME } from 'constants/chipin';
import { LS_KEY_LOCALE } from 'constants/localstorage';
import { lightThemeStyled } from 'constants/styled-themes';
import { LocalStorage, saveLocalUser } from 'helpers/localStorage';
import { isPublicLocaleSuggestionSuppressed } from 'helpers/publicLocaleSuggestion';
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
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                    <LocationPath />
                </Theme>
            </ThemeProvider>
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
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                    <LocationPath />
                </Theme>
            </ThemeProvider>
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
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                    <LocationPath />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('link', { name: PROJECT_NAME })).then(() => {
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

    expect(screen.queryByRole('button', { name: i18n.t('header.devMenu') })).toBeNull();
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

    return interaction
        .click(screen.getByRole('button', { name: 'Interface language' }))
        .then(() => {
            expect(screen.getByRole('link', { name: 'English' }).getAttribute('href')).toBe(
                '/privacy',
            );
            expect(screen.getByRole('link', { name: 'Russian' }).getAttribute('href')).toBe(
                '/ru/privacy',
            );
        });
});

test('signed-in visitors retain the public legal language selector', () => {
    const interaction = userEvent.setup();
    useAuthStore.setState({ status: 'authenticated' });

    render(
        <MemoryRouter initialEntries={['/ru/terms']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction
        .click(screen.getByRole('button', { name: 'Interface language' }))
        .then(() => {
            expect(screen.getByRole('link', { name: 'English' }).getAttribute('href')).toBe(
                '/terms',
            );
            expect(screen.getByRole('link', { name: 'Russian' }).getAttribute('href')).toBe(
                '/ru/terms',
            );
        });
});

// 04-4a2 (spec 04 §4.5 step 1): the landing and legal-page sign-in on a legacy host opens the app
// host; on any other host it opens the auth modal.
test.each([
    ['chipin.one', '/', 'https://app.chipin.one/dashboard'],
    ['dev.chipin.one', '/privacy', 'https://app-dev.chipin.one/dashboard'],
])('on %s the sign-in of %s opens %s', (hostname, path, target) => {
    const interaction = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, hostname, assign });
    useAuthStore.setState({ status: 'unauthenticated' });

    render(
        <MemoryRouter initialEntries={[path]}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction
        .click(screen.getByRole('button', { name: i18n.t('header.signIn') }))
        .then(() => {
            expect(assign).toHaveBeenCalledExactlyOnceWith(target);
            expect(screen.queryByRole('dialog')).toBeNull();
        })
        .finally(() => {
            vi.unstubAllGlobals();
        });
});

test('on an app host the landing sign-in opens the auth modal', () => {
    const interaction = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, hostname: 'app.chipin.one', assign });
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
        .click(screen.getByRole('button', { name: i18n.t('header.signIn') }))
        .then(() => {
            expect(assign).not.toHaveBeenCalled();
            expect(screen.getByRole('dialog')).toBeTruthy();
        })
        .finally(() => {
            vi.unstubAllGlobals();
        });
});

test.each([
    ['/login', '/'],
    ['/not-found', '/'],
    ['/ru/privacy', '/ru/'],
])('04-2f site paths: signed out on %s the logo is a plain link to %s', (path, href) => {
    useAuthStore.setState({ status: 'unauthenticated' });

    render(
        <MemoryRouter initialEntries={[path]}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                </Theme>
            </ThemeProvider>
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
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <Header />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: i18n.t('header.signIn') })).toBeNull();
});
