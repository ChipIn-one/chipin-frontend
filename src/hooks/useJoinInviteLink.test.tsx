import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';
import { beforeEach, expect, test, vi } from 'vitest';

import { act, renderHook, waitFor } from '@testing-library/react';

import { ROUTES } from 'constants/routes';

import { useJoinInviteLink } from './useJoinInviteLink';

const mocks = vi.hoisted(() => ({
    inviteToken: 'AbCdEfGhIjKlMnOpQrStUvWxYz012345',
    joinGroup: vi.fn(),
    navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mocks.navigate,
    useParams: () => ({ inviteToken: mocks.inviteToken }),
}));

vi.mock('store/groupsStore', () => ({
    useGroupsStore: () => ({ joinGroup: mocks.joinGroup }),
}));

vi.mock('helpers/errors', () => ({
    getApiErrorStatus: () => undefined,
    resolveApiErrorMessageFromError: (_error: unknown, fallbackMessage: string) => fallbackMessage,
}));

vi.mock('i18next', () => ({
    default: { t: (key: string) => key },
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.inviteToken = TEST_INVITE_TOKEN;
});

test('does not join on mount; confirm joins once and opens the group', () => {
    mocks.joinGroup.mockResolvedValue({ id: 'group-1' });

    const { result } = renderHook(() => useJoinInviteLink());

    expect(result.current.status).toBe('ready');
    expect(mocks.joinGroup).not.toHaveBeenCalled();

    act(() => {
        result.current.confirm();
        result.current.confirm();
    });

    return waitFor(() => {
        expect(mocks.joinGroup).toHaveBeenCalledTimes(1);
        expect(mocks.joinGroup).toHaveBeenCalledWith({ inviteToken: TEST_INVITE_TOKEN });
        expect(mocks.navigate).toHaveBeenCalledWith(`${ROUTES.GROUP}/group-1`, { replace: true });
    });
});

test.each(['short', '..%2Fx', '../g/members/u/kick', 'a'.repeat(65)])(
    'reports malformed invite token %s as invalid without calling the API',
    inviteToken => {
        mocks.inviteToken = inviteToken;

        const { result } = renderHook(() => useJoinInviteLink());

        act(() => {
            result.current.confirm();
        });

        expect(result.current.status).toBe('invalid');
        expect(mocks.joinGroup).not.toHaveBeenCalled();
    },
);
