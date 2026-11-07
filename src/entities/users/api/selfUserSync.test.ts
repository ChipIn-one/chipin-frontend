// The `LocalUser` sync of the self query: a load cancelled after its response arrived, but before
// that response was handled (a self write confirmed, a sign-out), writes nothing.
import { QueryClient } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';

import { getLocalUser, saveLocalUser } from 'helpers/localStorage';

import { selfUserQueryOptions, usersKeys } from './queries';

const answer = vi.hoisted(() => ({ resolve: (_body: unknown): void => undefined }));

vi.mock('shared/api/client', () => ({
    api: vi.fn(
        () =>
            new Promise(resolve => {
                answer.resolve = resolve;
            }),
    ),
}));

const settings = {
    defaultCurrency: 'USD',
    defaultCategory: 'food',
    timeFormat: '24h',
    language: 'en',
    theme: 'light',
    simplifyDebts: true,
    skipCategory: false,
    soloModeByDefault: false,
    saveGroupExpensesToSolo: false,
    sex: 'male',
} as const;

const wireUser = (theme: 'light' | 'dark') => ({
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite',
    isPremium: false,
    settings: { ...settings, theme },
    createdAt: 1,
    updatedAt: 1,
});

test('a load cancelled between its response and its handling leaves LocalUser unchanged', async () => {
    saveLocalUser({ id: 'user-1', role: 'USER', settings });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const load = client.fetchQuery(selfUserQueryOptions()).catch(() => undefined);
    await Promise.resolve();

    // The stale response arrives, and in the same tick a confirmed write cancels the load.
    answer.resolve(wireUser('dark'));
    void client.cancelQueries({ queryKey: usersKeys.self() });
    await load;
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getLocalUser()?.settings.theme).toBe('light');
});

test('a load that is not cancelled keeps LocalUser in step', async () => {
    saveLocalUser({ id: 'user-1', role: 'USER', settings });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const load = client.fetchQuery(selfUserQueryOptions());
    await Promise.resolve();

    answer.resolve(wireUser('dark'));
    await load;

    expect(getLocalUser()?.settings.theme).toBe('dark');
});
