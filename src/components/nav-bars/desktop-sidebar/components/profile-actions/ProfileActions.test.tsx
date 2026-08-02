import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test, vi } from 'vitest';

import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { User } from 'api/chipin.types';
import { lightThemeStyled } from 'constants/styled-themes';
import { useAuthStore } from 'store/authStore';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import ProfileActions from './ProfileActions';

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

const signOut = useAuthStore.getState().signOut;

const renderProfileActions = (isSoloMode = false) => {
    return render(
        <ThemeProvider theme={lightThemeStyled}>
            <Theme>
                <ProfileActions isSoloMode={isSoloMode} />
            </Theme>
        </ThemeProvider>,
    );
};

beforeEach(() => {
    useAuthStore.setState({ signOut, status: 'authenticated' });
    useLoadingStore.getState().setInitialLoadingStore();
    useLoadingStore.getState().setLoading('users', 'self', 'fetched');
    useUsersStore.setState({ user, localUser: null, friends: [] });
});

test('expands and collapses the profile actions', () => {
    const interaction = userEvent.setup();
    const { container } = renderProfileActions();
    const profileButton = screen.getByRole('button', {
        name: /Alex.*user@example\.com/i,
    });

    expect(profileButton.getAttribute('aria-expanded')).toBe('false');
    expect(profileButton.getAttribute('data-accent-color')).toBe('green');
    expect(profileButton.querySelector('.lucide-chevron-down')).toBeTruthy();
    expect(container.querySelector('.rt-AvatarRoot')?.classList.contains('rt-r-size-4')).toBe(
        true,
    );
    expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull();

    return interaction
        .click(profileButton)
        .then(() => {
            expect(profileButton.getAttribute('aria-expanded')).toBe('true');
            expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy();

            return interaction.click(profileButton);
        })
        .then(() => {
            expect(profileButton.getAttribute('aria-expanded')).toBe('false');
            expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull();
        });
});

test('uses the Solo mode color', () => {
    renderProfileActions(true);

    expect(
        screen
            .getByRole('button', { name: /Alex.*user@example\.com/i })
            .getAttribute('data-accent-color'),
    ).toBe('violet');
});

test('signs out directly from the expanded profile actions', () => {
    const interaction = userEvent.setup();
    const onSignOut = vi.fn(() => Promise.resolve());
    useAuthStore.setState({ signOut: onSignOut });
    renderProfileActions();

    return interaction
        .click(screen.getByRole('button', { name: /Alex.*user@example\.com/i }))
        .then(() => interaction.click(screen.getByRole('button', { name: 'Sign Out' })))
        .then(() => {
            expect(onSignOut).toHaveBeenCalledOnce();
        });
});

test('disables sign out while the request is loading', () => {
    const interaction = userEvent.setup();
    useLoadingStore.getState().setLoading('auth', 'signOut', 'loading');
    renderProfileActions();

    return interaction
        .click(screen.getByRole('button', { name: /Alex.*user@example\.com/i }))
        .then(() => {
            expect(
                (screen.getByRole('button', { name: 'Sign Out' }) as HTMLButtonElement)
                    .disabled,
            ).toBe(true);
        });
});
