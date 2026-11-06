import { Theme } from '@radix-ui/themes';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { SelfUser } from 'api/chipin.types';
import type { UsersStoreActions } from 'store/users-store';
import { useUsersStore } from 'store/users-store';

import RegionalSection from './RegionalSection';

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
                  settings: { ...state.user.settings, ...params.settings },
              }
            : null,
    }));

    return Promise.resolve();
});
const actualSetUserSettings = useUsersStore.getState().setUserSettings;

beforeEach(() => {
    setUserSettings.mockClear();
    Object.defineProperty(navigator, 'languages', {
        configurable: true,
        value: ['de-DE', 'ru-RU'],
    });
    useUsersStore.setState({ user, localUser: null, setUserSettings });
});

afterEach(() => {
    useUsersStore.setState({ setUserSettings: actualSetUserSettings });
});

test('resets the interface language to the first supported browser language', () => {
    const interaction = userEvent.setup();

    render(
        <Theme>
            <RegionalSection isLoading={false} />
        </Theme>,
    );

    return interaction.click(screen.getByRole('button', { name: 'Reset language' })).then(() =>
        waitFor(() => {
            expect(useUsersStore.getState().user?.settings.language).toBe('ru');
        }),
    );
});

// #609: a backend setting that still holds a removed locale shows English.
test.each(['es', 'pt-BR', 'pt-PT'])('shows English for the removed saved language %s', language => {
    useUsersStore.setState({ user: { ...user, settings: { ...user.settings, language } } });

    render(
        <Theme>
            <RegionalSection isLoading={false} />
        </Theme>,
    );

    expect(screen.getByRole('button', { name: 'English' })).toBeTruthy();
    expect(setUserSettings).not.toHaveBeenCalled();
});
