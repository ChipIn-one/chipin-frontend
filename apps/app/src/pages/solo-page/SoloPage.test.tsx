import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import type { UserSettings } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { saveLocalUser } from 'helpers/localStorage';
import { APP_MODES, useUiPrefsStore } from 'store/ui-prefs';
import { getOrThrow } from 'test/getOrThrow';

import { SoloPage } from './SoloPage';

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
    useUiPrefsStore.setState({ appMode: APP_MODES.SOLO });
    saveLocalUser({ role: 'ADMIN', settings });

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

test('uses the shared profile shortcut to open Settings from Solo', () => {
    const interaction = userEvent.setup();
    useUiPrefsStore.setState({ appMode: APP_MODES.SOLO });
    saveLocalUser({ role: 'ADMIN', settings });

    const CurrentRoute = () => {
        const location = useLocation();

        return <output aria-label="Current route">{location.pathname}</output>;
    };

    render(
        <MemoryRouter initialEntries={['/solo']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <SoloPage />
                    <CurrentRoute />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    return interaction.click(screen.getByRole('link', { name: 'Settings' })).then(() => {
        expect(screen.getByLabelText('Current route').textContent).toBe('/settings');
    });
});

test('DSH-016: each Solo placeholder offers Go to dashboard, which switches to group mode', () => {
    const interaction = userEvent.setup();
    useUiPrefsStore.setState({ appMode: APP_MODES.SOLO });
    saveLocalUser({ role: 'ADMIN', settings });

    const CurrentRoute = () => {
        const location = useLocation();

        return <output aria-label="Current route">{location.pathname}</output>;
    };

    render(
        <MemoryRouter initialEntries={['/solo']}>
            <ThemeProvider theme={lightThemeStyled}>
                <Theme>
                    <SoloPage />
                    <CurrentRoute />
                </Theme>
            </ThemeProvider>
        </MemoryRouter>,
    );

    const actions = screen.getAllByRole('button', { name: 'Go to dashboard' });

    expect(actions).toHaveLength(2);

    return interaction.click(getOrThrow(actions, 1)).then(() => {
        expect(useUiPrefsStore.getState().appMode).toBe(APP_MODES.GROUP);
        expect(screen.getByLabelText('Current route').textContent).toBe('/dashboard');
    });
});
