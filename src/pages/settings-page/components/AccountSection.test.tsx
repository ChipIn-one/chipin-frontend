import { ThemeProvider } from 'styled-components';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { SelfUser } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import type { UsersStoreActions } from 'store/users-store';
import { useUsersStore } from 'store/users-store';

import AccountSection from './AccountSection';

import 'i18n/index';

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Alex',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
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
    createdAt: 1,
    updatedAt: 1,
} satisfies SelfUser;

const setUserSettings = vi.fn((params: Parameters<UsersStoreActions['setUserSettings']>[0]) => {
    useUsersStore.setState(state => ({
        user: state.user
            ? {
                  ...state.user,
                  ...(params.displayName !== undefined && { displayName: params.displayName }),
                  settings: { ...state.user.settings, ...params.settings },
              }
            : null,
    }));

    return Promise.resolve();
});
const actualSetUserSettings = useUsersStore.getState().setUserSettings;

beforeEach(() => {
    setUserSettings.mockClear();
    useUsersStore.setState({ user, localUser: null, friends: [], setUserSettings });
});

afterEach(() => {
    useUsersStore.setState({ setUserSettings: actualSetUserSettings });
});

test('saves gender immediately without a page-level save action', () => {
    const interaction = userEvent.setup();

    render(
        <ThemeProvider theme={lightThemeStyled}>
            <AccountSection isLoading={false} />
        </ThemeProvider>,
    );

    const maleRadio = screen.getByRole('radio', { name: 'Male' });
    const femaleRadio = screen.getByRole('radio', { name: 'Female' });

    expect(maleRadio.getAttribute('aria-checked')).toBe('true');
    expect(femaleRadio.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();

    return interaction
        .click(femaleRadio)
        .then(() =>
            waitFor(() => {
                expect(setUserSettings).toHaveBeenCalledTimes(1);
                expect(setUserSettings).toHaveBeenCalledWith({ settings: { sex: 'female' } });
                expect(useUsersStore.getState().user?.settings.sex).toBe('female');
            }),
        );
});

test('starts with the current display name and saves it on blur', () => {
    const interaction = userEvent.setup();

    render(
        <ThemeProvider theme={lightThemeStyled}>
            <AccountSection isLoading={false} />
        </ThemeProvider>,
    );

    const displayNameInput = screen.getByRole('textbox', {
        name: 'Display name',
    }) as HTMLInputElement;

    expect(displayNameInput.value).toBe('Alex');
    expect(screen.getByText('4 / 64')).toBeTruthy();

    return interaction
        .clear(displayNameInput)
        .then(() => interaction.type(displayNameInput, 'Sam'))
        .then(() => {
            expect(setUserSettings).not.toHaveBeenCalled();
            return interaction.tab();
        })
        .then(() =>
            waitFor(() => {
                expect(setUserSettings).toHaveBeenCalledTimes(1);
                expect(setUserSettings).toHaveBeenCalledWith({ displayName: 'Sam' });
                expect(useUsersStore.getState().user?.displayName).toBe('Sam');
            }),
        );
});

test('does not save a whitespace-only display name on blur', () => {
    const interaction = userEvent.setup();

    render(
        <ThemeProvider theme={lightThemeStyled}>
            <AccountSection isLoading={false} />
        </ThemeProvider>,
    );

    const displayNameInput = screen.getByRole('textbox', { name: 'Display name' });

    return interaction
        .clear(displayNameInput)
        .then(() => interaction.type(displayNameInput, '   '))
        .then(() => interaction.tab())
        .then(() => {
            expect(displayNameInput.getAttribute('aria-invalid')).toBe('true');
            expect(screen.getByText('Display name is required.')).toBeTruthy();
            expect(setUserSettings).not.toHaveBeenCalled();
        });
});

test('initializes the display name draft when the user fetch completes', () => {
    useUsersStore.setState({ user: null, localUser: null, friends: [] });

    const view = render(
        <ThemeProvider theme={lightThemeStyled}>
            <AccountSection isLoading />
        </ThemeProvider>,
    );

    act(() => {
        useUsersStore.setState({ user });
    });

    view.rerender(
        <ThemeProvider theme={lightThemeStyled}>
            <AccountSection isLoading={false} />
        </ThemeProvider>,
    );

    return waitFor(() => {
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe(user.displayName);
    });
});

test('opens the avatar upload modal from the change photo action', () => {
    const interaction = userEvent.setup();

    render(
        <ThemeProvider theme={lightThemeStyled}>
            <AccountSection isLoading={false} />
        </ThemeProvider>,
    );

    return interaction
        .click(screen.getByRole('button', { name: 'Change photo' }))
        .then(() => {
            expect(screen.getByRole('dialog', { name: 'Update profile photo' })).toBeTruthy();
        });
});
