import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';

import type { UserSettings } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/users-store';

import SoloPage from './SoloPage';

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

test('renders the preserved Solo dashboard layout without release mode controls', () => {
    useDashboardStore.setState({ appMode: APP_MODES.SOLO });
    useUsersStore.setState({ user: null, localUser: { role: 'ADMIN', settings }, friends: [] });

    render(
        <MemoryRouter initialEntries={['/solo']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <SoloPage />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    expect(screen.queryByRole('switch', { name: 'Group mode' })).toBeNull();
    expect(screen.getByText('Solo summary')).not.toBeNull();
    expect(screen.queryByText('Solo records')).toBeNull();
    expect(screen.getByText('Solo activity')).not.toBeNull();
    expect(screen.getAllByText('Still in development.')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
});
