import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { APP_MODES, useDashboardStore } from 'store/dashboardStore';

import ViewModeSwitch from './ViewModeSwitch';

import 'i18n/index';

const LocationPath = () => {
    const location = useLocation();

    return <output aria-label="Current route">{location.pathname}</output>;
};

beforeEach(() => {
    useDashboardStore.setState({ appMode: APP_MODES.GROUP });
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
