import { Theme } from '@radix-ui/themes';
import type { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import { type SelfUser, usersKeys } from 'entities/users';
import { setupMswServer } from 'test/mswServer';
import { serveSelfUpdates, signInWithSelf } from 'test/selfUser';

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

const server = setupMswServer();
let client: QueryClient;
let updates: unknown[];

beforeEach(() => {
    Object.defineProperty(navigator, 'languages', {
        configurable: true,
        value: ['de-DE', 'ru-RU'],
    });
    client = signInWithSelf(user);
    updates = serveSelfUpdates(server, client);
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
            expect(updates).toEqual([{ settings: { language: 'ru' } }]);
            expect(client.getQueryData<SelfUser>(usersKeys.self())?.settings.language).toBe('ru');
        }),
    );
});

// #609: a backend setting that still holds a removed locale shows English.
test.each(['es', 'pt-BR', 'pt-PT'])('shows English for the removed saved language %s', language => {
    client.setQueryData(usersKeys.self(), { ...user, settings: { ...user.settings, language } });

    render(
        <Theme>
            <RegionalSection isLoading={false} />
        </Theme>,
    );

    expect(screen.getByRole('button', { name: 'English' })).toBeTruthy();
    expect(updates).toEqual([]);
});
