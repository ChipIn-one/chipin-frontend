import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { beforeEach, expect, test, vi } from 'vitest';

import type { FriendUser } from 'api/chipin.types';
import { useAuthStore } from 'store/authStore';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import RemoveFriendAlertDialog from './RemoveFriendAlertDialog';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { name?: string }) =>
            options?.name ? `${key}:${options.name}` : key,
    }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const friend = {
    id: 'friend-1',
    email: 'friend@example.com',
    displayName: 'Friend One',
    firstName: 'Friend',
    lastName: 'One',
    picture: null,
    createdAt: 1,
    updatedAt: 1,
} satisfies FriendUser;

const server = setupMswServer();

beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    mountAsUserClient();
});

test('waits for explicit confirmation before removing a friend', () => {
    const removed: string[] = [];
    const user = userEvent.setup();

    server.use(
        http.delete('*/users/known-users/:id', ({ params }) => {
            removed.push(String(params.id));
            return new HttpResponse(null, { status: 204 });
        }),
    );

    render(<RemoveFriendAlertDialog friend={friend} isOpened setIsOpened={vi.fn()} />);

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(removed).toEqual([]);

    return user
        .click(screen.getByRole('button', { name: 'friends:actions.removeFriend' }))
        .then(() => {
            return waitFor(() => {
                expect(removed).toEqual([friend.id]);
                expect(toast.success).toHaveBeenCalledWith('toasts:friend.removed:Friend One');
            });
        });
});

test('a failed removal shows one error toast and no success', () => {
    const user = userEvent.setup();

    server.use(
        http.delete('*/users/known-users/:id', () =>
            HttpResponse.json({ code: 'SYSTEM.INTERNAL' }, { status: 400 }),
        ),
    );

    render(<RemoveFriendAlertDialog friend={friend} isOpened setIsOpened={vi.fn()} />);

    return user
        .click(screen.getByRole('button', { name: 'friends:actions.removeFriend' }))
        .then(() =>
            waitFor(() => {
                expect(toast.error).toHaveBeenCalledTimes(1);
                expect(toast.success).not.toHaveBeenCalled();
            }),
        );
});
