import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { saveLocalUser } from 'helpers/localStorage';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';

import { HeaderNav } from './HeaderNav';

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
    saveLocalUser({ role: 'ADMIN', settings });
});

test.each([
    { appMode: APP_MODES.SOLO, expectedRoute: '/dashboard' },
    { appMode: APP_MODES.GROUP, expectedRoute: '/dashboard' },
])('opens $expectedRoute from the home link in $appMode mode', ({ appMode, expectedRoute }) => {
    const interaction = userEvent.setup();
    useUiPrefsStore.setState({ appMode });

    render(
        <MemoryRouter initialEntries={['/settings']}>
            <HeaderNav />
            <LocationPath />
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('link', { name: 'Dashboard' })).then(() => {
        expect(screen.getByLabelText('Current route').textContent).toBe(expectedRoute);
    });
});

test('marks the active link with aria-current, not by color alone', () => {
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });

    render(
        <MemoryRouter initialEntries={['/activity']}>
            <HeaderNav />
        </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Activity' }).getAttribute('aria-current')).toBe(
        'page',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull();
});
