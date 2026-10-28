import { toast } from 'sonner';
import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';
import { beforeEach, expect, test, vi } from 'vitest';

import { renderHook, waitFor } from '@testing-library/react';

import { ROUTES } from 'constants/routes';

import { useJoinInviteLink } from './useJoinInviteLink';

const mocks = vi.hoisted(() => ({
    inviteToken: 'AbCdEfGhIjKlMnOpQrStUvWxYz012345',
    isLoggedIn: true,
    joinGroup: vi.fn(),
    navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mocks.navigate,
    useParams: () => ({ inviteToken: mocks.inviteToken }),
}));

vi.mock('store/authStore', () => ({
    useAuthStore: () => mocks.isLoggedIn,
}));

vi.mock('store/groupsStore', () => ({
    useGroupsStore: () => ({ joinGroup: mocks.joinGroup }),
}));

vi.mock('helpers/errors', () => ({
    resolveApiErrorMessageFromError: (_error: unknown, fallbackMessage: string) => fallbackMessage,
}));

vi.mock('i18next', () => ({
    default: { t: (key: string) => key },
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        warning: vi.fn(),
    },
}));

beforeEach(() => {
    mocks.inviteToken = TEST_INVITE_TOKEN;
    mocks.isLoggedIn = true;
});

test('joins the group for a valid invite token and opens the group', () => {
    mocks.joinGroup.mockResolvedValue({ id: 'group-1' });

    renderHook(() => useJoinInviteLink());

    return waitFor(() => {
        expect(mocks.joinGroup).toHaveBeenCalledWith({ inviteToken: TEST_INVITE_TOKEN });
        expect(mocks.navigate).toHaveBeenCalledWith(`${ROUTES.GROUP}/group-1`, { replace: true });
    });
});

test.each(['short', '..%2Fx', '../g/members/u/kick', 'a'.repeat(65)])(
    'rejects malformed invite token %s without calling the API',
    inviteToken => {
        mocks.inviteToken = inviteToken;

        renderHook(() => useJoinInviteLink());

        expect(mocks.joinGroup).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith('toasts:group.inviteJoinError');
        expect(mocks.navigate).toHaveBeenCalledWith(ROUTES.DASHBOARD, { replace: true });
    },
);
