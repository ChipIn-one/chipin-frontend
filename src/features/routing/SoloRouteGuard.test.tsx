import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { UserSettings } from 'api/chipin.types';
import { useAuthStore } from 'store/authStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import SoloRouteGuard from './SoloRouteGuard';

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

const renderGuard = (role: 'USER' | 'ADMIN') => {
    useUsersStore.setState({
        user: null,
        localUser: { role, settings },
        friends: [],
    });

    render(
        <MemoryRouter initialEntries={['/solo']}>
            <Routes>
                <Route
                    path="/solo"
                    element={
                        <SoloRouteGuard>
                            <LocationPath />
                        </SoloRouteGuard>
                    }
                />
                <Route path="/dashboard" element={<LocationPath />} />
            </Routes>
        </MemoryRouter>,
    );
};

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated' });
    useLoadingStore.getState().setInitialLoadingStore();
    useLoadingStore.getState().setLoading('users', 'self', 'fetched');
    useUsersStore.getState().setInitialUsersStore();
});

test.each(['USER', 'ADMIN'] as const)('redirects a $role from the Solo route to the dashboard', role => {
    renderGuard(role);

    expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
});
