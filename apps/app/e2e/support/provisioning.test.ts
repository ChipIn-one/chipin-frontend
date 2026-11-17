import { describe, expect, it, vi } from 'vitest';

import {
    assertStagingApiReachable,
    createProvisioningClient,
    createRunId,
    formatPurgeCounts,
    isRunId,
    parsePurgeCounts,
    type ProvisionedUser,
    purgeAndVerify,
    type PurgeCounts,
    readGroupInviteToken,
    readRefreshCookieValue,
} from './provisioning';

const BASIC_AUTH = { username: 'e2e-user', password: 'e2e-secret-password' };
const RUN_ID = 'fe-e2e-1-abc';
const REFRESH_COOKIE =
    '__Host-chipin_refresh=refresh-value; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=60';

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
    new Response(JSON.stringify(body), {
        status: 200,
        ...init,
        headers: { 'Content-Type': 'application/json', ...init.headers },
    });

const USER_A: ProvisionedUser = {
    id: 'user-a',
    displayName: 'E2E A',
    accessToken: 'access-token-a',
    refreshCookieValue: 'refresh-a',
};

const publicUser = (id: string) => ({
    id,
    email: `${id}@example.test`,
    displayName: id,
    createdAt: 1,
    updatedAt: 1,
});

const groupResponse = (inviteToken: unknown) => ({
    id: 'group-1',
    name: 'E2E Group',
    inviteToken,
    description: null,
    creator: publicUser('user-a'),
    members: [{ user: publicUser('user-a'), balancesByCurrency: {} }],
    createdAt: 1,
    updatedAt: 1,
    coverUrl: null,
    simplifyDebts: false,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: { items: [], nextCursor: null },
});

describe('readRefreshCookieValue', () => {
    it('returns the value of a host-only, secure refresh cookie', () => {
        expect(readRefreshCookieValue(['other=1; Path=/', REFRESH_COOKIE])).toBe('refresh-value');
    });

    it.each([
        '__Host-chipin_refresh=v; Path=/; HttpOnly; SameSite=Strict',
        '__Host-chipin_refresh=v; Path=/; Secure; SameSite=Strict',
        '__Host-chipin_refresh=v; Path=/; Secure; HttpOnly; SameSite=Lax',
        '__Host-chipin_refresh=v; Path=/api; Secure; HttpOnly; SameSite=Strict',
        '__Host-chipin_refresh=v; Path=/; Secure; HttpOnly; SameSite=Strict; Domain=chipin.one',
    ])('rejects a cookie that breaks the policy: %s', header => {
        expect(() => readRefreshCookieValue([header])).toThrow(
            'Refresh cookie violates the required security attributes',
        );
    });

    it('fails when the cookie is missing or empty, without echoing headers', () => {
        expect(() => readRefreshCookieValue(['other=1'])).toThrow(
            'test-register did not set the refresh cookie',
        );
        expect(() =>
            readRefreshCookieValue([
                '__Host-chipin_refresh=; Path=/; Secure; HttpOnly; SameSite=Strict',
            ]),
        ).toThrow('Refresh cookie is empty');
    });
});

describe('parsePurgeCounts', () => {
    const counts = {
        runId: RUN_ID,
        deletedUsers: 2,
        deletedGroups: 1,
        deletedExpenses: 1,
        deletedSettlements: 0,
        deletedActivityEvents: 3,
    };

    it('parses and formats the purge counts', () => {
        const parsed = parsePurgeCounts(counts, RUN_ID);

        expect(parsed).toEqual(counts);
        expect(formatPurgeCounts(parsed)).toBe(
            `run ${RUN_ID}: users=2 groups=1 expenses=1 settlements=0 activityEvents=3`,
        );
    });

    it('rejects another run id or a broken count', () => {
        expect(() => parsePurgeCounts({ ...counts, runId: 'other' }, RUN_ID)).toThrow(
            'purge response runId does not match the run',
        );
        expect(() => parsePurgeCounts({ ...counts, deletedUsers: -1 }, RUN_ID)).toThrow(
            'purge.deletedUsers must be a non-negative integer',
        );
    });
});

describe('createRunId', () => {
    it('creates distinct ids in the fe-e2e namespace', () => {
        const first = createRunId();

        expect(first).toMatch(/^fe-e2e-\d+-[0-9a-f]{12}$/);
        expect(createRunId()).not.toBe(first);
        expect(isRunId(first)).toBe(true);
    });
});

describe('isRunId', () => {
    it('accepts the format the CI workflow creates', () => {
        expect(isRunId('fe-e2e-1763370000000-0123456789ab')).toBe(true);
    });

    it.each([
        '',
        'fe-e2e-1-abc',
        'fe-e2e-1763370000000-0123456789AB',
        'fe-e2e-1763370000000-0123456789ab0',
        'e2e-1763370000000-0123456789ab',
        'fe-e2e-1763370000000-0123456789ab/../x',
        ' fe-e2e-1763370000000-0123456789ab',
    ])('rejects %j', value => {
        expect(isRunId(value)).toBe(false);
    });
});

describe('purgeAndVerify', () => {
    const counts = (deletedUsers: number): PurgeCounts => ({
        runId: RUN_ID,
        deletedUsers,
        deletedGroups: 0,
        deletedExpenses: 0,
        deletedSettlements: 0,
        deletedActivityEvents: 0,
    });

    it('purges, then verifies with a second purge that deletes no user', async () => {
        const purge = vi
            .fn<() => Promise<PurgeCounts>>()
            .mockResolvedValueOnce(counts(3))
            .mockResolvedValueOnce(counts(0));

        await expect(purgeAndVerify({ purge })).resolves.toEqual(counts(3));
        expect(purge).toHaveBeenCalledTimes(2);
    });

    it('retries a failed purge once', async () => {
        const purge = vi
            .fn<() => Promise<PurgeCounts>>()
            .mockRejectedValueOnce(new Error('HTTP 502'))
            .mockResolvedValueOnce(counts(2))
            .mockRejectedValueOnce(new Error('HTTP 502'))
            .mockResolvedValueOnce(counts(0));

        await expect(purgeAndVerify({ purge })).resolves.toEqual(counts(2));
        expect(purge).toHaveBeenCalledTimes(4);
    });

    it('fails when a purge fails twice', async () => {
        const purge = vi
            .fn<() => Promise<PurgeCounts>>()
            .mockRejectedValueOnce(new Error('first'))
            .mockRejectedValueOnce(new Error('second'));

        await expect(purgeAndVerify({ purge })).rejects.toThrow('second');
        expect(purge).toHaveBeenCalledTimes(2);
    });

    it('fails when the verifying purge still deletes users', async () => {
        const purge = vi
            .fn<() => Promise<PurgeCounts>>()
            .mockResolvedValueOnce(counts(2))
            .mockResolvedValueOnce(counts(1));

        await expect(purgeAndVerify({ purge })).rejects.toThrow('Run purge left users behind');
    });
});

describe('assertStagingApiReachable', () => {
    it('passes when the staging API answers 401 to an anonymous self request', async () => {
        const fetchImpl = vi.fn<typeof fetch>(() =>
            Promise.resolve(new Response(null, { status: 401 })),
        );

        await expect(assertStagingApiReachable(fetchImpl)).resolves.toBeUndefined();
        expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('https://api-dev.chipin.one/users/self');
    });

    it('names the staging API on an outage', async () => {
        await expect(
            assertStagingApiReachable(() => Promise.resolve(new Response(null, { status: 503 }))),
        ).rejects.toThrow('Staging API https://api-dev.chipin.one is unavailable');
        await expect(
            assertStagingApiReachable(() => Promise.reject(new TypeError('fetch failed'))),
        ).rejects.toThrow('Staging API https://api-dev.chipin.one is unreachable');
    });
});

describe('createProvisioningClient', () => {
    it('registers a user with Basic auth and captures its refresh cookie', async () => {
        const fetchImpl = vi.fn<typeof fetch>(() =>
            Promise.resolve(
                jsonResponse(
                    {
                        runId: RUN_ID,
                        accessToken: 'access-token',
                        expiresIn: 60,
                        user: { id: 'user-a', email: 'a@example.test', displayName: 'E2E A' },
                    },
                    { status: 201, headers: { 'Set-Cookie': REFRESH_COOKIE } },
                ),
            ),
        );
        const client = createProvisioningClient(BASIC_AUTH, RUN_ID, fetchImpl);

        await expect(client.register('E2E A')).resolves.toEqual({
            id: 'user-a',
            displayName: 'E2E A',
            accessToken: 'access-token',
            refreshCookieValue: 'refresh-value',
        });

        const [url, init] = fetchImpl.mock.calls[0] ?? [];
        const headers = new Headers(init?.headers);

        expect(String(url)).toBe('https://api-dev.chipin.one/auth/test-register');
        expect(headers.get('Authorization')).toBe(
            `Basic ${Buffer.from('e2e-user:e2e-secret-password').toString('base64')}`,
        );
        expect(init?.redirect).toBe('error');
        expect(init?.body).toBe(JSON.stringify({ displayName: 'E2E A', runId: RUN_ID }));
    });

    it('purges the run and keeps credentials out of failure messages', async () => {
        const client = createProvisioningClient(BASIC_AUTH, RUN_ID, () =>
            Promise.resolve(jsonResponse({ code: 'AUTH.UNAUTHORIZED' }, { status: 401 })),
        );

        const failure = await client.purge().then(
            () => null,
            (error: unknown) => (error instanceof Error ? error.message : String(error)),
        );

        expect(failure).toBe(
            `Staging API https://api-dev.chipin.one: DELETE /auth/test-runs/${RUN_ID} failed with HTTP 401`,
        );
        expect(failure).not.toContain(BASIC_AUTH.password);
        expect(failure).not.toContain(BASIC_AUTH.username);
    });
});

describe('readGroupInviteToken', () => {
    it('returns the invite token of a valid group', () => {
        expect(readGroupInviteToken(groupResponse('invite-token-1'))).toBe('invite-token-1');
    });

    it('rejects a group without a token, without echoing the response', () => {
        expect(() => readGroupInviteToken(groupResponse(''))).toThrow(
            'group.inviteToken must be a non-empty string',
        );
        expect(() => readGroupInviteToken(groupResponse(undefined))).toThrow(
            'group.inviteToken must be a non-empty string',
        );
    });

    it('rejects a response that is not a group', () => {
        expect(() => readGroupInviteToken({ inviteToken: 'invite-token-1' })).toThrow(
            'group.id must be a non-empty string',
        );
    });
});

describe('createProvisioningClient group reads', () => {
    it('reads the group invite token as a member', async () => {
        const fetchImpl = vi.fn<typeof fetch>(() =>
            Promise.resolve(jsonResponse(groupResponse('invite-token-1'))),
        );
        const client = createProvisioningClient(BASIC_AUTH, RUN_ID, fetchImpl);

        await expect(client.getGroupInviteToken(USER_A, 'group-1')).resolves.toBe('invite-token-1');

        const [url, init] = fetchImpl.mock.calls[0] ?? [];

        expect(String(url)).toBe('https://api-dev.chipin.one/groups/group-1');
        expect(init?.method).toBe('GET');
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer access-token-a');
    });

    it('names only the method and path when the group read fails', async () => {
        const client = createProvisioningClient(BASIC_AUTH, RUN_ID, () =>
            Promise.resolve(jsonResponse({ code: 'GROUP.NOT_FOUND' }, { status: 404 })),
        );

        await expect(client.getGroupInviteToken(USER_A, 'group-1')).rejects.toThrow(
            'Staging API https://api-dev.chipin.one: GET /groups/group-1 failed with HTTP 404',
        );
    });
});
