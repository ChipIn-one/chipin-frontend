import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { saveLocalUser } from 'helpers/localStorage';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';

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
    useUiPrefsStore.setState({ appMode: APP_MODES.GROUP });
    saveLocalUser({ role: 'ADMIN', settings });
});

test.each(['USER', 'ADMIN'] as const)('hides the mode switch for a $role user', role => {
    saveLocalUser({ role, settings });

    render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <ViewModeSwitch />
        </MemoryRouter>,
    );

    expect(screen.queryByRole('switch', { name: 'Group mode' })).toBeNull();
});
