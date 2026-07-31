import { beforeEach, expect, test, vi } from 'vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { FriendUser } from 'api/chipin.types';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import RemoveFriendAlertDialog from './RemoveFriendAlertDialog';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { name?: string }) =>
            options?.name ? `${key}:${options.name}` : key,
    }),
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn() },
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

beforeEach(() => {
    vi.clearAllMocks();
    useLoadingStore.getState().setInitialLoadingStore();
});

test('waits for explicit confirmation before removing a friend', () => {
    const removeFriend = vi.fn().mockResolvedValue(friend.displayName);
    const user = userEvent.setup();

    useUsersStore.setState({ removeFriend });

    render(
        <RemoveFriendAlertDialog
            friend={friend}
            isOpened
            setIsOpened={vi.fn()}
        />,
    );

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(removeFriend).not.toHaveBeenCalled();

    return user
        .click(screen.getByRole('button', { name: 'friends:actions.removeFriend' }))
        .then(() => {
            return waitFor(() => {
                expect(removeFriend).toHaveBeenCalledWith({ userId: friend.id });
            });
        });
});
