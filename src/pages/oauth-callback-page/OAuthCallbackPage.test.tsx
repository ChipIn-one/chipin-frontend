import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { useAuthStore } from 'store/authStore';

import { OAuthCallbackPage } from './OAuthCallbackPage';

import 'i18n/index';

vi.mock('basics/PageLoader', () => ({
    default: () => <div data-testid="page-loader" />,
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
    },
}));

const originalExchangeGoogleOAuthCode = useAuthStore.getState().exchangeGoogleOAuthCode;

const Destination = () => {
    const location = useLocation();
    const currentRoute = `${location.pathname}${location.search}${location.hash}`;

    return <div data-testid="destination">{currentRoute}</div>;
};

const renderCallback = (route: string) => {
    render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
                <Route path="*" element={<Destination />} />
            </Routes>
        </MemoryRouter>,
    );
};

beforeEach(() => {
    useAuthStore.setState({
        exchangeGoogleOAuthCode: originalExchangeGoogleOAuthCode,
        isNewUser: null,
        status: 'unauthenticated',
        unauthReason: 'missing',
    });
});

test('returns a missing-code callback to the sanitized return route', async () => {
    renderCallback(
        '/oauth/callback?returnTo=%2Fgroup%2F123%3Ftab%3Dmembers%23balances',
    );

    expect((await screen.findByTestId('destination')).textContent).toBe(
        '/group/123?tab=members#balances',
    );
    expect(useAuthStore.getState().unauthReason).toBe('error');
});

test('returns a failed OAuth exchange to the sanitized return route', async () => {
    const exchangeGoogleOAuthCode = vi.fn().mockRejectedValue(new Error('exchange failed'));
    useAuthStore.setState({ exchangeGoogleOAuthCode });

    renderCallback(
        '/oauth/callback?code=bad-code&returnTo=%2Factivity%3Ffilter%3Dmine%23latest',
    );

    expect((await screen.findByTestId('destination')).textContent).toBe(
        '/activity?filter=mine#latest',
    );
    expect(exchangeGoogleOAuthCode).toHaveBeenCalledWith('bad-code');
});

test('falls back home instead of redirecting back into the OAuth callback', async () => {
    renderCallback(
        '/oauth/callback?returnTo=%2Foauth%2Fcallback%3Fcode%3Dloop',
    );

    expect((await screen.findByTestId('destination')).textContent).toBe('/');
});
