// Connectivity end to end (spec 03 §8, §1.8): the real interceptors wired by the bootstrap, the
// classification and the connectivity store, with msw answering the request and `/health`.
import { onlineManager } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { initializeApi } from 'bootstrap/initializeApi';
import { LS_KEY_AUTH_SESSION_HINT } from 'constants/localstorage';
import { lightThemeStyled } from 'constants/styled-themes';
import { ProtectedRoute } from 'features/routing/ProtectedRoute';
import { invalidateAuthSession } from 'helpers/authSession';
import { LocalStorage } from 'helpers/localStorage';
import { useCheckSignIn } from 'hooks/useCheckSignIn';
import { publicApi } from 'shared/api/client';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { useGroupsStore } from 'store/groupsStore';
import { loadKnownUsersForSession, loadSelfUserForSession } from 'store/sessionUser';
import { setupMswServer } from 'test/mswServer';

import { BackendUnavailableGate } from 'components/backend-unavailable-page';
import { InternalPageLayout } from 'components/internal-page-layout';

vi.mock('store/sessionUser', async importOriginal => ({
    ...(await importOriginal<typeof import('store/sessionUser')>()),
    loadKnownUsersForSession: vi.fn(),
    loadSelfUserForSession: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('components/modals/auth-modal', () => ({
    AuthModal: () => <div role="dialog" aria-label="Sign in" />,
}));

vi.mock('components/nav-bars', () => ({
    DESKTOP_SHELL_MAX_WIDTH: '1200px',
    DesktopSidebar: () => null,
    MobileNavBar: () => null,
}));

const server = setupMswServer();
const BANNER = 'network.offlineBanner';
const PAGE_CONTENT = 'Cached page content';

let healthRequests = 0;

const answer = (stats: () => Response, health: () => Response) => {
    healthRequests = 0;
    server.use(
        http.get('*/stats', stats),
        http.get('*/health', () => {
            healthRequests += 1;
            return health();
        }),
    );
};

const renderApp = () =>
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <BackendUnavailableGate>
                <InternalPageLayout>
                    <p>{PAGE_CONTENT}</p>
                </InternalPageLayout>
            </BackendUnavailableGate>
        </ThemeProvider>,
    );

const requestStats = () => act(() => publicApi('get', '/stats').then(() => undefined));

beforeAll(() => {
    initializeApi();
});

beforeEach(() => {
    onlineManager.setOnline(true);
    useConnectivityStore.setState({ mode: 'online' });
});

afterEach(() => {
    onlineManager.setOnline(true);
});

test('onLine=false + a network error: the offline banner, no blocking page, no health probe', async () => {
    answer(
        () => HttpResponse.error(),
        () => HttpResponse.json({}),
    );
    renderApp();
    act(() => {
        onlineManager.setOnline(false);
    });

    await expect(requestStats()).rejects.toMatchObject({ isAxiosError: true });

    expect(screen.getByRole('status').textContent).toContain(BANNER);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(PAGE_CONTENT)).toBeTruthy();
    expect(healthRequests).toBe(0);
});

test('a network error and /health also unreachable: offline (banner), not the page', async () => {
    answer(
        () => HttpResponse.error(),
        () => HttpResponse.error(),
    );
    renderApp();

    await expect(requestStats()).rejects.toMatchObject({ isAxiosError: true });

    expect(onlineManager.isOnline()).toBe(false);
    expect(screen.getByText(BANNER)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
});

test('503 + /health 503: the backend-unavailable page, no banner', async () => {
    answer(
        () => HttpResponse.json({}, { status: 503 }),
        () => HttpResponse.json({}, { status: 503 }),
    );
    renderApp();

    await expect(requestStats()).rejects.toMatchObject({ name: 'ApiError', status: 503 });

    expect(useConnectivityStore.getState().mode).toBe('backend-down');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(BANNER)).toBeNull();
});

test('500 + /health 200: a request error only, the app stays as it is', async () => {
    answer(
        () => HttpResponse.json({ code: 'SYSTEM.INTERNAL' }, { status: 500 }),
        () => HttpResponse.json({ status: 'ok' }),
    );
    renderApp();

    await expect(requestStats()).rejects.toMatchObject({ name: 'ApiError', status: 500 });

    expect(healthRequests).toBe(1);
    expect(useConnectivityStore.getState().mode).toBe('online');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(BANNER)).toBeNull();
});

test('a 4xx is left to the call site without a health probe', async () => {
    answer(
        () => HttpResponse.json({}, { status: 404 }),
        () => HttpResponse.json({}),
    );
    renderApp();

    await expect(requestStats()).rejects.toMatchObject({ name: 'ApiError', status: 404 });

    expect(healthRequests).toBe(0);
    expect(useConnectivityStore.getState().mode).toBe('online');
});

test('captive portal: after an offline classification the next successful response clears the banner', async () => {
    answer(
        () => HttpResponse.error(),
        () => HttpResponse.error(),
    );
    renderApp();
    await expect(requestStats()).rejects.toMatchObject({ isAxiosError: true });
    expect(screen.getByText(BANNER)).toBeTruthy();

    server.use(
        http.get('*/stats', () =>
            HttpResponse.json({
                usersCount: 1,
                groupsCount: 1,
                expensesCount: 1,
                settlementsCount: 1,
            }),
        ),
    );
    await requestStats();

    expect(onlineManager.isOnline()).toBe(true);
    expect(screen.queryByText(BANNER)).toBeNull();
});

// A cold start with a restorable session: the session check (`useCheckSignIn`) runs the real
// `/auth/refresh` through `apiInstance` and its interceptors.
describe('offline cold start through /auth/refresh', () => {
    const CheckSignIn = () => {
        useCheckSignIn();
        return null;
    };

    const renderColdStart = () =>
        render(
            <ThemeProvider theme={lightThemeStyled}>
                <MemoryRouter initialEntries={['/dashboard']}>
                    <CheckSignIn />
                    <ProtectedRoute>
                        <p>{PAGE_CONTENT}</p>
                    </ProtectedRoute>
                </MemoryRouter>
            </ThemeProvider>,
        );

    let refreshRequests = 0;

    const answerRefresh = (refresh: () => Response, health: () => Response) => {
        refreshRequests = 0;
        server.use(
            http.post('*/auth/refresh', () => {
                refreshRequests += 1;
                return refresh();
            }),
            http.get('*/health', health),
        );
    };

    beforeEach(() => {
        invalidateAuthSession();
        LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);
        useAuthStore.setState({ status: 'unknown', unauthReason: undefined, isNewUser: null });
        vi.spyOn(useGroupsStore.getState(), 'fetchSetGroups').mockResolvedValue([]);
        vi.mocked(loadSelfUserForSession).mockResolvedValue(null);
        vi.mocked(loadKnownUsersForSession).mockResolvedValue();
    });

    afterEach(() => {
        // Unmount before the top-level afterEach goes online: it would rerun the session check.
        cleanup();
        vi.restoreAllMocks();
        LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
    });

    test('the catch of the session check sees offline: no sign-out, the banner over the loader', async () => {
        answerRefresh(
            () => HttpResponse.error(),
            () => HttpResponse.error(),
        );
        renderColdStart();

        expect(await screen.findByText(BANNER)).toBeTruthy();
        expect(refreshRequests).toBe(1);
        expect(useConnectivityStore.getState().mode).toBe('offline');
        expect(useAuthStore.getState()).toMatchObject({
            status: 'unknown',
            unauthReason: undefined,
        });
        expect(screen.queryByText(PAGE_CONTENT)).toBeNull();
    });

    test('no online event ever fires: Retry after /health recovers resumes the session check', async () => {
        answerRefresh(
            () => HttpResponse.error(),
            () => HttpResponse.error(),
        );
        renderColdStart();
        const retry = await screen.findByRole('button', { name: 'network.retry' });

        answerRefresh(
            () => HttpResponse.json({ token: 'next-access-token' }),
            () => HttpResponse.json({ status: 'ok' }),
        );
        fireEvent.click(retry);

        await waitFor(() => {
            expect(useAuthStore.getState().status).toBe('authenticated');
        });
        expect(refreshRequests).toBe(1);
        expect(onlineManager.isOnline()).toBe(true);
        expect(await screen.findByText(PAGE_CONTENT)).toBeTruthy();
        expect(screen.queryByText(BANNER)).toBeNull();
    });
});
