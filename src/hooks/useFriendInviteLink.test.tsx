import { toast } from 'sonner';
import { beforeEach, expect, test, vi } from 'vitest';

import { renderHook, waitFor } from '@testing-library/react';

import { ROUTES } from 'constants/routes';

import { useFriendInviteLink } from './useFriendInviteLink';

const mocks = vi.hoisted(() => ({
    acceptFriendInvite: vi.fn(),
    inviteToken: 'friend-token',
    navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mocks.navigate,
    useParams: () => ({ inviteToken: mocks.inviteToken }),
}));

vi.mock('store/users-store', () => ({
    useUsersStore: (
        selector: (state: { acceptFriendInvite: typeof mocks.acceptFriendInvite }) => unknown,
    ) => selector({ acceptFriendInvite: mocks.acceptFriendInvite }),
}));

vi.mock('helpers/errors', () => ({
    resolveApiErrorMessageFromError: (
        _error: unknown,
        fallbackMessage: string,
    ) => fallbackMessage,
}));

vi.mock('i18next', () => ({
    default: {
        t: (key: string, params?: { name?: string }) =>
            params?.name ? `${key}:${params.name}` : key,
    },
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.inviteToken = 'friend-token';
});

test('USR-003 accepts the invite, shows the friend name and redirects to Friends', () => {
    mocks.acceptFriendInvite.mockResolvedValue({
        id: 'friend-1',
        email: 'alex@example.com',
        displayName: 'Alex',
        createdAt: 1,
        updatedAt: 1,
    });

    renderHook(() => useFriendInviteLink());

    return waitFor(() => {
        expect(mocks.acceptFriendInvite).toHaveBeenCalledWith({
            inviteToken: 'friend-token',
        });
        expect(toast.success).toHaveBeenCalledWith(
            'toasts:friend.inviteAcceptedWithName:Alex',
        );
        expect(mocks.navigate).toHaveBeenCalledWith(ROUTES.FRIENDS, {
            replace: true,
        });
    });
});

test('USR-003 keeps invite failures on the join route and shows an error', () => {
    mocks.acceptFriendInvite.mockRejectedValue(new Error('invalid invite'));

    renderHook(() => useFriendInviteLink());

    return waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('toasts:friend.inviteJoinError');
        expect(mocks.navigate).not.toHaveBeenCalled();
    });
});
