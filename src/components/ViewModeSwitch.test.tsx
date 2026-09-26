import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import type { UserSettings } from 'api/chipin.types';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/users-store';

import ViewModeSwitch from './ViewModeSwitch';

import 'i18n/index';

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

beforeEach(() => {
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
    useUsersStore.setState({
        user: null,
        localUser: { role: 'ADMIN', settings },
        friends: [],
    });
});

test.each(['USER', 'ADMIN'] as const)('hides the mode switch for a $role user', role => {
    useUsersStore.setState({
        user: null,
        localUser: { role, settings },
        friends: [],
    });

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ViewModeSwitch />
        </MemoryRouter>,
    );

    expect(screen.queryByRole('switch', { name: 'Group mode' })).toBeNull();
});
