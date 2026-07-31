import { ThemeProvider } from 'styled-components';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { User } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import type { UsersStoreActions } from 'store/users-store';
import { useUsersStore } from 'store/users-store';

import AccountSection from './AccountSection';

import 'i18n/index';

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Alex',
    firstName: null,
    lastName: null,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
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
} satisfies User;

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

test('selects the user sex from the profile radio group', () => {
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

    return interaction
        .click(femaleRadio)
        .then(() =>
            waitFor(() => {
                expect(useUsersStore.getState().user?.settings.sex).toBe('female');
                expect(maleRadio.getAttribute('aria-checked')).toBe('false');
                expect(femaleRadio.getAttribute('aria-checked')).toBe('true');
            }),
        );
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
