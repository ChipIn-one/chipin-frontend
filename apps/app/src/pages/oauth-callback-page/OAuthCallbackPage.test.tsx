import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { beforeEach, expect, test, vi } from 'vitest';

import { ApiError } from 'shared/lib/apiError';
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

test('AUTH-074 a callback without a code (consent cancelled) goes back to /login with the sanitized returnTo', () => {
    renderCallback('/oauth/callback?returnTo=%2Fgroup%2F123%3Ftab%3Dmembers%23balances');

    return screen.findByTestId('destination').then(destination => {
        expect(destination.textContent).toBe(
            `/login?returnTo=${encodeURIComponent('/group/123?tab=members#balances')}`,
        );
        expect(useAuthStore.getState().unauthReason).toBe('error');
    });
});

test('AUTH-074 a failed OAuth exchange goes back to /login with the sanitized returnTo', () => {
    const exchangeGoogleOAuthCode = vi.fn().mockRejectedValue(new Error('exchange failed'));
    useAuthStore.setState({ exchangeGoogleOAuthCode });

    renderCallback('/oauth/callback?code=bad-code&returnTo=%2Factivity%3Ffilter%3Dmine%23latest');

    return screen.findByTestId('destination').then(destination => {
        expect(destination.textContent).toBe(
            `/login?returnTo=${encodeURIComponent('/activity?filter=mine#latest')}`,
        );
        expect(exchangeGoogleOAuthCode).toHaveBeenCalledWith('bad-code');
    });
});

test('AUTH-016: asks to start sign-in again in this browser when the OAuth browser binding is missing', () => {
    // The exchange goes through axios: production rejects with an AxiosError, not an `ApiError`.
    const exchangeGoogleOAuthCode = vi.fn().mockRejectedValue({
        isAxiosError: true,
        response: { status: 400, data: { code: 'AUTH.OAUTH_BROWSER_BINDING_REQUIRED' } },
    });
    useAuthStore.setState({ exchangeGoogleOAuthCode });

    renderCallback('/oauth/callback?code=unbound-code');

    return screen.findByTestId('destination').then(() => {
        expect(toast.error).toHaveBeenCalledWith(
            'Google sign-in could not be finished. Please sign in again in this browser.',
        );
    });
});

test('shows the expired-code message for an invalid OAuth exchange code', () => {
    const exchangeGoogleOAuthCode = vi.fn().mockRejectedValue(
        new ApiError({
            status: 401,
            payload: { code: 'AUTH.INVALID_OAUTH_EXCHANGE_CODE' },
            cause: undefined,
        }),
    );
    useAuthStore.setState({ exchangeGoogleOAuthCode });

    renderCallback('/oauth/callback?code=spent-code');

    return screen.findByTestId('destination').then(() => {
        expect(toast.error).toHaveBeenCalledWith(
            'Google sign-in expired or is no longer valid. Please try again.',
        );
    });
});

test('AUTH-072 a callback returnTo falls back to the dashboard (via /login without a code)', () => {
    renderCallback('/oauth/callback?returnTo=%2Foauth%2Fcallback%3Fcode%3Dloop');

    return screen.findByTestId('destination').then(destination => {
        expect(destination.textContent).toBe('/login?returnTo=%2Fdashboard');
    });
});

test('AUTH-072 an open-redirect returnTo falls back to the dashboard (via /login without a code)', () => {
    renderCallback('/oauth/callback?returnTo=%2F%2Fevil.example');

    return screen.findByTestId('destination').then(destination => {
        expect(destination.textContent).toBe('/login?returnTo=%2Fdashboard');
    });
});
