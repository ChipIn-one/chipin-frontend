/* eslint-disable no-restricted-imports -- integration test drives the real Axios instance through the router to prove invite links cannot reach the API */
import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import axios, { type AxiosAdapter } from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { toast } from 'sonner';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';

import { InvalidPathSegmentError } from 'api/apiPath';
import { apiInstance } from 'api/chipin.instance';
import { i18n } from 'i18n';
import { api } from 'shared/api/client';
import { startCacheRestore } from 'shared/offline/restore';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';
import { createTestQueryClient } from 'test/renderWithQueryClient';

import { buildAppRoutes } from './createAppRouter';

vi.mock('@chipin/tokens/assets/logo.svg?react', () => ({
    default: () => <svg aria-hidden />,
}));

// The route tree with its guards and the real join page; the shell is not under test here.
vi.mock('./RootLayout', async () => {
    const { Outlet } = await import('react-router-dom');

    return { RootLayout: () => <Outlet /> };
});

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}));

const TRAVERSAL_ROUTE =
    '/group/join/..%2F11111111-1111-1111-1111-111111111111%2Fmembers%2F22222222-2222-2222-2222-222222222222%2Fkick';

const defaultAdapter = apiInstance.defaults.adapter;
const recordedPathnames: string[] = [];
const recordingAdapter = vi.fn<AxiosAdapter>(config => {
    recordedPathnames.push(new URL(axios.getUri(config), 'https://chipin.one').pathname);

    return Promise.resolve({
        config,
        data: {},
        headers: {},
        status: 200,
        statusText: 'OK',
    });
});

let routers: ReturnType<typeof createMemoryRouter>[] = [];

// What root.tsx does before the router renders: `restoreReady` resolves (no user cache to restore).
beforeAll(() => {
    startCacheRestore(undefined);
});

beforeEach(() => {
    recordedPathnames.length = 0;
    apiInstance.defaults.adapter = recordingAdapter;
    document.documentElement.lang = 'en';
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });
    return i18n.changeLanguage('en');
});

afterEach(() => {
    apiInstance.defaults.adapter = defaultAdapter;
    routers.forEach(router => router.dispose());
    routers = [];
});

test('a crafted group invite link never reaches the API and never hits /kick', () => {
    const router = createMemoryRouter(buildAppRoutes(createTestQueryClient()), {
        initialEntries: [TRAVERSAL_ROUTE],
    });

    routers.push(router);
    render(
        <Theme>
            <RouterProvider router={router} />
        </Theme>,
    );

    return screen.findByRole('heading', { name: i18n.t('group:join.invalidTitle') }).then(() => {
        expect(toast.error).not.toHaveBeenCalled();
        expect(recordingAdapter).not.toHaveBeenCalled();
        expect(recordedPathnames.some(pathname => /\/kick$/.test(pathname))).toBe(false);
    });
});

test('a direct API call with a traversal token is rejected before the adapter', () => {
    return expect(
        api('post', '/groups/invite/{inviteToken}', {
            params: { inviteToken: '../g/members/u/kick' },
        }),
    )
        .rejects.toBeInstanceOf(InvalidPathSegmentError)
        .then(() => {
            expect(recordingAdapter).not.toHaveBeenCalled();
        });
});
