import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { useAuthStore } from 'store/authStore';
import { useLoadingStore } from 'store/loadingStore';
import { signInWithSelf } from 'test/selfUser';

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

const renderGuard = (role: 'USER' | 'ADMIN' | null) => {
    if (role) {
        signInWithSelf({
            id: 'user-1',
            email: 'user@example.com',
            displayName: 'Alex',
            picture: null,
            role,
            subscriptionUntil: null,
            inviteToken: 'invite-token-user',
            settings,
            createdAt: 1,
            updatedAt: 1,
        });
    }
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
});

test.each(['USER', 'ADMIN'] as const)(
    'redirects a $role from the Solo route to the dashboard',
    role => {
        renderGuard(role);

        expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
    },
);

test('waits while the self user is still to come', () => {
    renderGuard(null);

    expect(screen.queryByLabelText('Current route')).toBeNull();
});
