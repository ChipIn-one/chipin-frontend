import { onlineManager } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { FriendCurrencyGroup, KnownUser } from 'entities/users';
import { useAuthStore } from 'store/authStore';
import { createKnownUser, seedKnownUsers } from 'test/knownUsers';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import FriendsPage from './FriendsPage';

vi.mock('components/internal-page-layout', () => ({
    InternalPageColumnsFromSm: ({ children }: { children: React.ReactNode }) => children,
}));

// The list as its props: the page's job is the view and the loading / empty state.
vi.mock('./components', () => ({
    FriendsSidebar: () => null,
    FriendsList: (props: {
        currencyGroups: readonly FriendCurrencyGroup[];
        isEmpty: boolean;
        isLoading: boolean;
        settledFriends: readonly KnownUser[];
    }) => (
        <output>
            {props.isLoading
                ? 'loading'
                : props.isEmpty
                  ? 'empty'
                  : [
                        ...props.currencyGroups.map(
                            group => `${group.currency}:${group.net.minor.toString()}`,
                        ),
                        ...props.settledFriends.map(friend => `settled:${friend.user.id}`),
                    ].join(' ')}
        </output>
    ),
}));

const server = setupMswServer();

beforeEach(() => {
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
});

afterEach(() => {
    onlineManager.setOnline(true);
});

test('renders the friends grouped by currency with exact Money totals and the settled ones', () => {
    seedKnownUsers([
        createKnownUser('friend-1', [['USD', 8_999_999_999_999_997n]]),
        createKnownUser('friend-2', [['USD', 3n]]),
        createKnownUser('friend-3'),
    ]);

    render(<FriendsPage />);

    expect(screen.getByRole('status').textContent).toBe('USD:9000000000000000 settled:friend-3');
});

test('shows the skeleton before the first load and the invite state for no friends', () => {
    server.use(http.get('*/users/known-users', () => new Promise<never>(() => undefined)));
    mountAsUserClient();
    const { unmount } = render(<FriendsPage />);

    expect(screen.getByRole('status').textContent).toBe('loading');
    unmount();

    seedKnownUsers([]);
    render(<FriendsPage />);

    expect(screen.getByRole('status').textContent).toBe('empty');
});

test('signed in on the anonymous client (before the remount) shows the skeleton', () => {
    // No user client registered: the query is disabled and its data is never read.
    render(<FriendsPage />);

    expect(screen.getByRole('status').textContent).toBe('loading');
});

test('a first load waiting for the network shows the invite state, as before', async () => {
    server.use(http.get('*/users/known-users', () => HttpResponse.json({ friends: [] })));
    mountAsUserClient();
    onlineManager.setOnline(false);

    render(<FriendsPage />);

    await waitFor(() => {
        expect(screen.getByRole('status').textContent).toBe('empty');
    });
});
