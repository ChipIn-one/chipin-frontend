import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { ROUTES } from 'constants/routes';
import { useAuthStore } from 'store/authStore';
import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';
import { wireGroup } from 'test/groupFixtures';
import { setupMswServer } from 'test/mswServer';
import { mountAsUserClient } from 'test/userClient';

import { useJoinInviteLink } from './useJoinInviteLink';

const mocks = vi.hoisted(() => ({
    inviteToken: 'AbCdEfGhIjKlMnOpQrStUvWxYz012345',
    joinGroup: vi.fn<(params: { inviteToken: string }) => Promise<{ id: string }>>(),
    navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mocks.navigate,
    useParams: () => ({ inviteToken: mocks.inviteToken }),
}));

vi.mock('helpers/errors', () => ({
    getApiErrorStatus: () => undefined,
    resolveApiErrorMessageFromError: (_error: unknown, fallbackMessage: string) => fallbackMessage,
}));

vi.mock('i18next', () => ({
    default: { t: (key: string) => key },
}));

const server = setupMswServer();

const statusOf = (error: unknown): number | undefined =>
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    typeof error.response.status === 'number'
        ? error.response.status
        : undefined;

// `POST /groups/invite/{inviteToken}` answered by `mocks.joinGroup`: its `{ id }` becomes that
// group, its rejection with a `response.status` that status, any other rejection no response at
// all (a network failure).
const serveJoin = (): void => {
    server.use(
        http.post('*/groups/invite/:inviteToken', ({ params }) =>
            Promise.resolve()
                .then(() => mocks.joinGroup({ inviteToken: String(params.inviteToken) }))
                .then(
                    ({ id }) => HttpResponse.json(wireGroup(id)),
                    (error: unknown) => {
                        const status = statusOf(error);

                        return status === undefined
                            ? HttpResponse.error()
                            : HttpResponse.json({}, { status });
                    },
                ),
        ),
        http.get('*/groups', () => HttpResponse.json({ items: [], nextCursor: null })),
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.inviteToken = TEST_INVITE_TOKEN;
    useAuthStore.setState({ status: 'authenticated', sessionMode: 'online' });
    mountAsUserClient();
    serveJoin();
});

afterEach(() => {
    useAuthStore.setState({ status: 'unknown' });
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

test('a join that gets no response shows the error and a retry joins', async () => {
    mocks.joinGroup
        .mockRejectedValueOnce(new Error('no response'))
        .mockResolvedValueOnce({ id: 'group-1' });
    const { result } = renderHook(() => useJoinInviteLink());

    act(() => {
        result.current.confirm();
    });
    await waitFor(() => {
        expect(result.current.status).toBe('error');
    });
    expect(result.current.errorMessage).toBe('toasts:group.inviteJoinError');
    expect(mocks.navigate).not.toHaveBeenCalled();

    act(() => {
        result.current.confirm();
    });
    await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith(`${ROUTES.GROUP}/group-1`, { replace: true });
    });
    expect(mocks.joinGroup).toHaveBeenCalledTimes(2);
});
