// Spec 04 §2.2 `login` (04-2f): the sign-in screen, its validated `?returnTo` and `?locale`.
import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { i18n } from 'i18n';
import { useAuthStore } from 'store/authStore';

import { LoginPage } from './LoginPage';

vi.mock('assets/google-icon.svg?react', () => ({
    default: () => <svg aria-hidden="true" />,
}));

vi.mock('basics/PageLoader', () => ({
    default: () => <div data-testid="page-loader" />,
}));

const CurrentRoute = () => {
    const location = useLocation();

    return <main>{location.pathname + location.search}</main>;
};

const renderLogin = (url: string) => {
    const router = createMemoryRouter(
        [
            { path: '/login', element: <LoginPage /> },
            { path: '*', element: <CurrentRoute /> },
        ],
        { initialEntries: [url] },
    );

    render(
        <Theme>
            <RouterProvider router={router} />
        </Theme>,
    );
    return router;
};

/** The `returnTo` and `locale` the Google button sends to the backend. */
const signInTarget = (assign: ReturnType<typeof vi.fn>) => {
    const authUrl = new URL(String(assign.mock.calls[0]?.[0]));
    const callbackUrl = new URL(authUrl.searchParams.get('redirect_to') ?? '');

    return {
        callback: callbackUrl.pathname,
        returnTo: callbackUrl.searchParams.get('returnTo'),
        locale: authUrl.searchParams.get('locale'),
    };
};

beforeEach(() => {
    useAuthStore.setState({ status: 'unauthenticated', unauthReason: 'missing' });
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['en-US']);
    return i18n.changeLanguage('en');
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('signed out', () => {
    test('04-2f login: renders the sign-in screen with the Google button', () => {
        renderLogin('/login');

        expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    });

    test('04-2f login: an unresolved session shows the loader, not the sign-in', () => {
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined });

        renderLogin('/login?returnTo=%2Fsettings');

        expect(screen.getByTestId('page-loader')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull();
    });

    test.each([
        ['%2Fgroup%2Fjoin%2Ftok-1', '/group/join/tok-1'],
        ['%2Fsettings%3Ftab%3Dprofile', '/settings?tab=profile'],
        ['', '/dashboard'],
        ['%2F%2Fevil.example', '/dashboard'],
        ['https%3A%2F%2Fevil.example', '/dashboard'],
        ['%2F%5Cevil.example', '/dashboard'],
        ['javascript%3Aalert(1)', '/dashboard'],
        ['%2Flogin%3FreturnTo%3D%252Fdashboard', '/dashboard'],
    ])(
        'AUTH-074 the Google sign-in for returnTo=%j returns to %s through the callback',
        async (encoded, expected) => {
            const assign = vi.fn();
            vi.stubGlobal('location', { ...window.location, assign });
            const interaction = userEvent.setup();
            renderLogin(`/login?returnTo=${encoded}`);

            await interaction.click(screen.getByRole('button', { name: 'Sign in with Google' }));

            expect(signInTarget(assign)).toMatchObject({
                callback: '/oauth/callback',
                returnTo: expected,
            });
        },
    );

    test.each([
        ['ru', 'ru'],
        ['en', 'en'],
        ['de', 'en'],
        ['ru-RU', 'en'],
    ])('AUTH-076 ?locale=%s gives the registration locale %s', async (locale, expected) => {
        const assign = vi.fn();
        vi.stubGlobal('location', { ...window.location, assign });
        const interaction = userEvent.setup();
        renderLogin(`/login?locale=${locale}`);

        await interaction.click(screen.getByRole('button', { name: 'Sign in with Google' }));

        expect(signInTarget(assign).locale).toBe(expected);
    });
});

describe('signed in', () => {
    beforeEach(() => {
        useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
    });

    test.each([
        ['/login', '/dashboard'],
        ['/login?returnTo=%2Fgroup%2Fjoin%2Ftok-1', '/group/join/tok-1'],
        ['/login?returnTo=%2Factivity%3Ffilter%3Dmine', '/activity?filter=mine'],
        ['/login?returnTo=%2F%2Fevil.example', '/dashboard'],
        ['/login?returnTo=%2F%5C%5Cevil.example', '/dashboard'],
        ['/login?returnTo=%2Flogin', '/dashboard'],
        ['/login?returnTo=%2Foauth%2Fcallback%3Fcode%3Dx', '/dashboard'],
    ])('AUTH-073 %s sends a signed-in user straight to %s', async (url, expected) => {
        const router = renderLogin(url);

        expect(await screen.findByRole('main')).toBeTruthy();
        expect(router.state.location.pathname + router.state.location.search).toBe(expected);
        // Replaced, not pushed: Back does not return to the sign-in screen (#835).
        expect(router.state.historyAction).toBe('REPLACE');
    });
});
