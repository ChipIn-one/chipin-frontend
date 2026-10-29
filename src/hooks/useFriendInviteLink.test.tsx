import { toast } from 'sonner';
import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';
import { beforeEach, expect, test, vi } from 'vitest';

import { act, renderHook, waitFor } from '@testing-library/react';

import { ROUTES } from 'constants/routes';

import { useFriendInviteLink } from './useFriendInviteLink';

const mocks = vi.hoisted(() => ({
    acceptFriendInvite: vi.fn(),
    authSessionVersion: 1,
    inviteToken: 'AbCdEfGhIjKlMnOpQrStUvWxYz012345',
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

vi.mock('helpers/authSession', () => ({
    getAuthSessionVersion: () => mocks.authSessionVersion,
    isAuthSessionCurrent: (version: number) => version === mocks.authSessionVersion,
}));

vi.mock('helpers/errors', () => ({
    getApiErrorStatus: () => undefined,
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
    mocks.authSessionVersion = 1;
    mocks.inviteToken = TEST_INVITE_TOKEN;
});

test.each(['short', '..%2Fx', '../g/members/u/kick', 'a'.repeat(65)])(
    'reports malformed invite token %s as invalid without calling the API',
    inviteToken => {
        mocks.inviteToken = inviteToken;

        const { result } = renderHook(() => useFriendInviteLink());

        act(() => {
            result.current.confirm();
        });

        expect(result.current.status).toBe('invalid');
        expect(mocks.acceptFriendInvite).not.toHaveBeenCalled();
    },
);

test('USR-003 accepts the invite, shows the friend name and redirects to Friends', () => {
    mocks.acceptFriendInvite.mockResolvedValue({
        id: 'friend-1',
        email: 'alex@example.com',
        displayName: 'Alex',
        createdAt: 1,
        updatedAt: 1,
    });

    const { result } = renderHook(() => useFriendInviteLink());
    expect(mocks.acceptFriendInvite).not.toHaveBeenCalled();
    act(() => {
        result.current.confirm();
    });

    return waitFor(() => {
        expect(mocks.acceptFriendInvite).toHaveBeenCalledWith({
            inviteToken: TEST_INVITE_TOKEN,
        });
        expect(toast.success).toHaveBeenCalledWith(
            'toasts:friend.inviteAcceptedWithName:Alex',
        );
        expect(mocks.navigate).toHaveBeenCalledWith(ROUTES.FRIENDS, {
            replace: true,
        });
    });
});

test('USR-003 keeps invite failures on the join route and shows the error state', () => {
    mocks.acceptFriendInvite.mockRejectedValue(new Error('invalid invite'));

    const { result } = renderHook(() => useFriendInviteLink());
    expect(mocks.acceptFriendInvite).not.toHaveBeenCalled();
    act(() => {
        result.current.confirm();
    });

    return waitFor(() => {
        expect(result.current.status).toBe('error');
        expect(result.current.errorMessage).toBe('toasts:friend.inviteJoinError');
        expect(toast.error).not.toHaveBeenCalled();
        expect(mocks.navigate).not.toHaveBeenCalled();
    });
});

test('ignores a successful invite completion after the join route unmounts', () => {
    let resolveInvite: ((friend: {
        id: string;
        email: string;
        displayName: string;
        createdAt: number;
        updatedAt: number;
    }) => void) | undefined;
    mocks.acceptFriendInvite.mockImplementation(() => new Promise(resolve => {
        resolveInvite = resolve;
    }));

    const { result, unmount } = renderHook(() => useFriendInviteLink());
    act(() => {
        result.current.confirm();
    });
    unmount();

    return act(() => {
        resolveInvite?.({
            id: 'friend-1',
            email: 'alex@example.com',
            displayName: 'Alex',
            createdAt: 1,
            updatedAt: 1,
        });

        return Promise.resolve();
    }).then(() => {
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
        expect(mocks.navigate).not.toHaveBeenCalled();
    });
});

test('ignores a failed invite completion after the auth session changes', () => {
    let rejectInvite: ((error: unknown) => void) | undefined;
    mocks.acceptFriendInvite.mockImplementation(() => new Promise((_resolve, reject) => {
        rejectInvite = reject;
    }));

    const { result } = renderHook(() => useFriendInviteLink());
    expect(mocks.acceptFriendInvite).not.toHaveBeenCalled();
    act(() => {
        result.current.confirm();
    });
    mocks.authSessionVersion += 1;

    return act(() => {
        rejectInvite?.(new Error('stale failure'));

        return Promise.resolve();
    }).then(() => {
        expect(toast.error).not.toHaveBeenCalled();
        expect(mocks.navigate).not.toHaveBeenCalled();
    });
});
