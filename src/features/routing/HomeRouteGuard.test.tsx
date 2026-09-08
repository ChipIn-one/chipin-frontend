import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import { act, render, screen } from '@testing-library/react';

import type { SelfUser, UserSettings } from 'api/chipin.types';
import { useAuthStore } from 'store/authStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

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

beforeEach(() => {
    useAuthStore.setState({ status: 'unknown' });
    useUsersStore.getState().setInitialUsersStore();
    useLoadingStore.getState().setInitialLoadingStore();
});

test('opens the dashboard for a non-admin user regardless of the Solo default', () => {
    useAuthStore.setState({ status: 'authenticated' });
    useLoadingStore.getState().setLoading('users', 'self', 'fetched');
    useUsersStore.setState({
        user: null,
        localUser: {
            role: 'USER',
            settings,
        },
        friends: [],
    });

    renderGuard();

    expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
});

test('opens the dashboard for an admin user regardless of the Solo default', () => {
    useAuthStore.setState({ status: 'authenticated' });
    useLoadingStore.getState().setLoading('users', 'self', 'fetched');
    useUsersStore.setState({
        user: null,
        localUser: {
            role: 'ADMIN',
            settings,
        },
        friends: [],
    });

    renderGuard();

    expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
});

test('waits for fetched settings instead of routing from a stale cached preference', () => {
    useAuthStore.setState({ status: 'authenticated' });
    useLoadingStore.getState().setLoading('users', 'self', 'loading');
    useUsersStore.setState({
        user: null,
        localUser: {
            role: 'USER',
            settings: { ...settings, soloModeByDefault: false },
        },
        friends: [],
    });

    renderGuard();

    expect(screen.queryByLabelText('Current route')).toBeNull();

    act(() => {
        useUsersStore.setState({
            user: {
                id: 'user-1',
                email: 'user@example.com',
                displayName: 'Alex',
                picture: null,
                role: 'USER',
                subscriptionUntil: null,
                inviteToken: 'invite-token-user',
                settings,
                createdAt: 1,
                updatedAt: 1,
            } satisfies SelfUser,
        });
        useLoadingStore.getState().setLoading('users', 'self', 'fetched');
    });

    expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
});
