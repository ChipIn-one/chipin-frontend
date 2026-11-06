import { Theme } from '@radix-ui/themes';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { get, set } from 'idb-keyval';
import { beforeEach, expect, test, vi } from 'vitest';

import { clientFor } from 'shared/offline/restore';

import { RestoreGate } from './RestoreGate';
import { UserQueryProvider } from './UserQueryProvider';

import 'fake-indexeddb/auto';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));
vi.mock('idb-keyval', async importOriginal => {
    const actual = await importOriginal<typeof import('idb-keyval')>();

    return { ...actual, get: vi.fn(actual.get), set: vi.fn(actual.set) };
});

const ROUTES_TEXT = 'routes';
const LATE_KEY = ['groups', 'list'];
const seen: QueryClient[] = [];
const ClientProbe = () => {
    seen.push(useQueryClient());
    return <p>{ROUTES_TEXT}</p>;
};

const renderApp = (userId?: string) =>
    render(
        <Theme>
            <UserQueryProvider userId={userId}>
                <RestoreGate>
                    <ClientProbe />
                </RestoreGate>
            </UserQueryProvider>
        </Theme>,
    );

beforeEach(() => {
    seen.length = 0;
});

test('signed out (and the landing): no persistence, no IndexedDB read, routes at once', () => {
    renderApp();

    expect(screen.getByText('routes')).not.toBeNull();
    expect(get).not.toHaveBeenCalled();
});

test('a user: the skeleton until the cache is restored, then the routes on that user client', async () => {
    const pending: { release: (value: undefined) => void } = { release: () => undefined };
    vi.mocked(get).mockImplementationOnce(
        () =>
            new Promise(resolve => {
                pending.release = resolve;
            }),
    );

    renderApp('gate-user');

    expect(screen.getByTestId('restore-skeleton')).not.toBeNull();
    expect(screen.queryByText('routes')).toBeNull();

    pending.release(undefined);

    expect(await screen.findByText(ROUTES_TEXT)).not.toBeNull();
    expect(seen[seen.length - 1]).toBe(clientFor('gate-user'));
});

test('another user gets another client', async () => {
    const view = renderApp('switch-a');
    await screen.findByText(ROUTES_TEXT);

    view.rerender(
        <Theme>
            <UserQueryProvider userId="switch-b">
                <RestoreGate>
                    <ClientProbe />
                </RestoreGate>
            </UserQueryProvider>
        </Theme>,
    );
    await screen.findByText(ROUTES_TEXT);

    expect(seen[seen.length - 1]).toBe(clientFor('switch-b'));
    expect(clientFor('switch-a')).not.toBe(clientFor('switch-b'));
});

test('a user id that appears after boot (sign-in) gets its own restore and save subscription', async () => {
    const view = renderApp();
    expect(get).not.toHaveBeenCalled();

    // The session load wrote `LocalUser.id`: the tree remounts on that user's client.
    view.rerender(
        <Theme>
            <UserQueryProvider userId="late-user">
                <RestoreGate>
                    <ClientProbe />
                </RestoreGate>
            </UserQueryProvider>
        </Theme>,
    );

    await screen.findByText(ROUTES_TEXT);
    expect(get).toHaveBeenCalledWith('chipin:rq:late-user');
    expect(seen[seen.length - 1]).toBe(clientFor('late-user'));

    clientFor('late-user').setQueryData(LATE_KEY, ['saved']);
    await vi.waitFor(() => {
        expect(set).toHaveBeenCalledWith('chipin:rq:late-user', expect.stringContaining('saved'));
        // The persister is throttled to one write per second.
    }, 3000);
});
