import { Button } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';
import { useUsersStore } from 'store/users-store';

import { useSyncAppMode } from './useSyncAppMode';

const DASHBOARD_LABEL = 'Dashboard';

const settings = {
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
} satisfies UserSettings;

const TestHarness = () => {
    const navigate = useNavigate();

    useSyncAppMode();

    return (
        <Button
            onClick={() => {
                void navigate('/dashboard');
            }}
        >
            {DASHBOARD_LABEL}
        </Button>
    );
};

beforeEach(() => {
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });
    useUsersStore.setState({ user: null, localUser: null, friends: [] });
});

test.each(['USER', 'ADMIN'] as const)(
    'does not activate Solo mode for a $role direct Solo route',
    role => {
        useUsersStore.setState({
            user: null,
            localUser: { role, settings },
            friends: [],
        });

        render(
            <MemoryRouter initialEntries={['/solo']}>
                <TestHarness />
            </MemoryRouter>,
        );

        expect(useUiPrefsStore.getState().appMode).toBe(APP_MODES.GROUP);
    },
);

test('sets Group mode when navigation reaches the dashboard route', () => {
    const interaction = userEvent.setup();

    useUiPrefsStore.setState({ appMode: APP_MODES.SOLO });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <TestHarness />
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('button', { name: DASHBOARD_LABEL })).then(() => {
        expect(useUiPrefsStore.getState().appMode).toBe(APP_MODES.GROUP);
    });
});

test('preserves the active mode on a route without its own mode', () => {
    useUiPrefsStore.setState({ appMode: APP_MODES.SOLO });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <TestHarness />
        </MemoryRouter>,
    );

    expect(useUiPrefsStore.getState().appMode).toBe(APP_MODES.SOLO);
});
