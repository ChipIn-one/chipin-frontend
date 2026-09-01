import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import { Button } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/users-store';

import { useSyncAppMode } from './useSyncAppMode';

const DASHBOARD_LABEL = 'Dashboard';

const TestHarness = () => {
    const navigate = useNavigate();

    useSyncAppMode();

    return <Button onClick={() => navigate('/dashboard')}>{DASHBOARD_LABEL}</Button>;
};

beforeEach(() => {
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    useUsersStore.setState({ user: null, localUser: null, friends: [] });
});

test('sets Solo mode for a direct Solo route', () => {
    useUsersStore.setState({
        user: null,
        localUser: {
            role: 'ADMIN',
            settings: {
                defaultCurrency: 'USD',
                defaultCategory: 'food',
                timeFormat: '24h',
                language: 'en',
                theme: 'system',
                simplifyDebts: true,
                skipCategory: false,
                soloModeByDefault: false,
                saveGroupExpensesToSolo: false,
                sex: 'male',
            },
        },
        friends: [],
    });

    render(
        <MemoryRouter initialEntries={['/solo']}>
            <TestHarness />
        </MemoryRouter>,
    );

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.SOLO);
});

test('does not activate Solo mode for a non-admin direct Solo route', () => {
    render(
        <MemoryRouter initialEntries={['/solo']}>
            <TestHarness />
        </MemoryRouter>,
    );

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.GROUP);
});

test('sets Group mode when navigation reaches the dashboard route', () => {
    const interaction = userEvent.setup();

    useDashboardStore.setState({ appMode: APP_MODES.SOLO });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <TestHarness />
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('button', { name: DASHBOARD_LABEL })).then(() => {
        expect(useDashboardStore.getState().appMode).toBe(APP_MODES.GROUP);
    });
});

test('preserves the active mode on a route without its own mode', () => {
    useDashboardStore.setState({ appMode: APP_MODES.SOLO });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <TestHarness />
        </MemoryRouter>,
    );

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.SOLO);
});
