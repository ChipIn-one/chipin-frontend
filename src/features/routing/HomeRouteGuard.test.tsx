import { onlineManager } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, test } from 'vitest';

import type { SelfUser, UserSettings } from 'api/chipin.types';
import { saveLocalUser } from 'helpers/localStorage';
import { useAuthStore } from 'store/authStore';
import { useConnectivityStore } from 'store/connectivityStore';
import { useLoadingStore } from 'store/loadingStore';
import { setupMswServer } from 'test/mswServer';
import { signInWithSelf } from 'test/selfUser';
import { mountAsUserClient } from 'test/userClient';

import HomeRouteGuard from './HomeRouteGuard';

const LocationPath = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
};

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

const renderGuard = () => {
    render(
        <MemoryRouter initialEntries={['/']}>
            <Routes>
                <Route
                    path="/"
                    element={
                        <HomeRouteGuard>
                            <div />
                        </HomeRouteGuard>
                    }
                />
                <Route path="/dashboard" element={<LocationPath />} />
                <Route path="/solo" element={<LocationPath />} />
            </Routes>
        </MemoryRouter>,
    );
};

const user = (role: 'USER' | 'ADMIN', soloModeByDefault: boolean): SelfUser => ({
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Alex',
    picture: null,
    role,
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
    settings: { ...settings, soloModeByDefault },
    createdAt: 1,
    updatedAt: 1,
});

const server = setupMswServer();

/** Answers `GET /users/self` with `respond` (default: never), counting the requests. */
const serveSelf = (respond?: () => Response): { count: number } => {
    const counter = { count: 0 };

    server.use(
        http.get('*/users/self', () => {
            counter.count += 1;
            return respond ? respond() : new Promise<never>(() => undefined);
        }),
    );
    return counter;
};

beforeEach(() => {
    useAuthStore.setState({ status: 'unknown', sessionMode: 'online' });
    useLoadingStore.getState().setInitialLoadingStore();
    saveLocalUser({ id: 'user-1', role: 'ADMIN', settings });
});

test.each([
    { role: 'USER', solo: true, route: '/dashboard' },
    { role: 'ADMIN', solo: true, route: '/dashboard' },
] as const)(
    'opens $route for a $role with the self user (Solo default $solo)',
    ({ role, solo, route }) => {
        signInWithSelf(user(role, solo));

        renderGuard();

        expect(screen.getByLabelText('Current route').textContent).toBe(route);
    },
);

test('waits for the self user instead of routing from a stale cached preference', async () => {
    useAuthStore.setState({ status: 'authenticated' });
    mountAsUserClient('user-1');
    serveSelf(() => HttpResponse.json(user('ADMIN', false)));

    renderGuard();

    expect(screen.queryByLabelText('Current route')).toBeNull();
    expect((await screen.findByLabelText('Current route')).textContent).toBe('/dashboard');
});

test('waits on the anonymous client of a first sign-in, sending nothing', async () => {
    useAuthStore.setState({ status: 'authenticated' });
    const requests = serveSelf();

    renderGuard();

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(screen.queryByLabelText('Current route')).toBeNull();
    expect(requests.count).toBe(0);
});

test('routes from the cached user when the self load fails', async () => {
    useAuthStore.setState({ status: 'authenticated' });
    mountAsUserClient('user-1');
    serveSelf(() => HttpResponse.json({}, { status: 500 }));

    renderGuard();

    expect((await screen.findByLabelText('Current route')).textContent).toBe('/dashboard');
});

test('an offline-cached session with nothing cached routes from the cached user, not a loader', async () => {
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'offline-cached' });
    onlineManager.setOnline(false);
    mountAsUserClient('user-1');
    const requests = serveSelf();

    renderGuard();

    expect((await screen.findByLabelText('Current route')).textContent).toBe('/dashboard');
    expect(requests.count).toBe(0);
});

afterEach(() => {
    onlineManager.setOnline(true);
    useConnectivityStore.setState({ mode: 'online' });
});

test('an unresolved session offline shows the offline banner instead of a bare loader', () => {
    useAuthStore.setState({ status: 'unknown' });
    onlineManager.setOnline(false);

    renderGuard();

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByLabelText('Current route')).toBeNull();
});
