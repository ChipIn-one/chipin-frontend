import type { QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { lightThemeStyled } from 'constants/styled-themes';
import { type SelfUser, usersKeys } from 'entities/users';
import { setupMswServer } from 'test/mswServer';
import { serveSelfUpdates, signInWithSelf } from 'test/selfUser';

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

const server = setupMswServer();
let client: QueryClient;
let updates: unknown[];

beforeEach(() => {
    client = signInWithSelf(user);
    updates = serveSelfUpdates(server, client);
});

const selfInCache = () => client.getQueryData<SelfUser>(usersKeys.self());

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

    return interaction.click(femaleRadio).then(() =>
        waitFor(() => {
            expect(updates).toEqual([{ settings: { sex: 'female' } }]);
            expect(selfInCache()?.settings.sex).toBe('female');
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

    const displayNameInput = screen.getByRole<HTMLInputElement>('textbox', {
        name: 'Display name',
    });

    expect(displayNameInput.value).toBe('Alex');
    expect(screen.getByText('4 / 64')).toBeTruthy();

    return interaction
        .clear(displayNameInput)
        .then(() => interaction.type(displayNameInput, 'Sam'))
        .then(() => {
            expect(updates).toEqual([]);
            return interaction.tab();
        })
        .then(() =>
            waitFor(() => {
                expect(updates).toEqual([{ displayName: 'Sam' }]);
                expect(selfInCache()?.displayName).toBe('Sam');
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
            expect(updates).toEqual([]);
        });
});

test('initializes the display name draft when the user fetch completes', () => {
    client.removeQueries({ queryKey: usersKeys.self() });

    const view = render(
        <ThemeProvider theme={lightThemeStyled}>
            <AccountSection isLoading />
        </ThemeProvider>,
    );

    act(() => {
        client.setQueryData(usersKeys.self(), user);
    });

    view.rerender(
        <ThemeProvider theme={lightThemeStyled}>
            <AccountSection isLoading={false} />
        </ThemeProvider>,
    );

    return waitFor(() => {
        const input = screen.getByRole<HTMLInputElement>('textbox');
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

    return interaction.click(screen.getByRole('button', { name: 'Change photo' })).then(() => {
        expect(screen.getByRole('dialog', { name: 'Update profile photo' })).toBeTruthy();
    });
});
