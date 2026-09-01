import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { UserSettings } from 'api/chipin.types';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/users-store';

import ViewModeSwitch from './ViewModeSwitch';

import 'i18n/index';

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

test('sets Solo mode and navigates to the Solo route', () => {
    const interaction = userEvent.setup();

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ViewModeSwitch />
            <LocationPath />
        </MemoryRouter>,
    );

    const modeSwitch = screen.getByRole('switch', { name: 'Group mode' });

    expect(modeSwitch.getAttribute('aria-checked')).toBe('true');

    return interaction.click(modeSwitch).then(() => {
        expect(useDashboardStore.getState().appMode).toBe(APP_MODES.SOLO);
        expect(screen.getByLabelText('Current route').textContent).toBe('/solo');
        expect(
            screen.getByRole('switch', { name: 'Group mode' }).getAttribute('aria-checked'),
        ).toBe('false');
    });
});

test('hides the mode switch for a non-admin user', () => {
    useUsersStore.setState({
        user: null,
        localUser: { role: 'USER', settings },
        friends: [],
    });

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ViewModeSwitch />
        </MemoryRouter>,
    );

    expect(screen.queryByRole('switch', { name: 'Group mode' })).toBeNull();
});
