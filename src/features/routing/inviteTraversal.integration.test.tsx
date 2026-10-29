/* eslint-disable no-restricted-imports -- integration test drives the real Axios instance through the router to prove invite links cannot reach the API */
import axios, { type AxiosAdapter } from 'axios';
import i18n from 'i18n';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

import { InvalidPathSegmentError } from 'api/apiPath';
import { inviteApiUserToGroup } from 'api/chipin';
import { apiInstance } from 'api/chipin.instance';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';

import AppRouter from './AppRouter';

vi.mock('assets/logo.svg?react', () => ({
    default: () => <svg aria-hidden />,
}));

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

beforeEach(() => {
    recordedPathnames.length = 0;
    apiInstance.defaults.adapter = recordingAdapter;
    document.documentElement.lang = 'en';
    useAuthStore.setState({ status: 'authenticated', unauthReason: undefined });
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    return i18n.changeLanguage('en');
});

afterEach(() => {
    apiInstance.defaults.adapter = defaultAdapter;
});

test('a crafted group invite link never reaches the API and never hits /kick', () => {
    render(
        <MemoryRouter initialEntries={[TRAVERSAL_ROUTE]}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <AppRouter />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return screen.findByRole('heading', { name: i18n.t('group:join.invalidTitle') }).then(() => {
        expect(toast.error).not.toHaveBeenCalled();
        expect(recordingAdapter).not.toHaveBeenCalled();
        expect(recordedPathnames.some(pathname => /\/kick$/.test(pathname))).toBe(false);
    });
});

test('a direct API call with a traversal token is rejected before the adapter', () => {
    return expect(inviteApiUserToGroup({ inviteToken: '../g/members/u/kick' }))
        .rejects.toBeInstanceOf(InvalidPathSegmentError)
        .then(() => {
            expect(recordingAdapter).not.toHaveBeenCalled();
        });
});
