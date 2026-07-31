import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import { Button } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { APP_MODES, useDashboardStore } from 'store/dashboardStore';

import { useSyncAppMode } from './useSyncAppMode';

const DASHBOARD_LABEL = 'Dashboard';

const TestHarness = () => {
    const navigate = useNavigate();

    useSyncAppMode();

    return <Button onClick={() => navigate('/dashboard')}>{DASHBOARD_LABEL}</Button>;
};

beforeEach(() => {
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
});

test('sets Solo mode for a direct Solo route', () => {
    render(
        <MemoryRouter initialEntries={['/solo']}>
            <TestHarness />
        </MemoryRouter>,
    );

    expect(useDashboardStore.getState().appMode).toBe(APP_MODES.SOLO);
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
