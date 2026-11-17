// Staging test provisioning for the Playwright smoke (docs/e2e-tests.md), over Node `fetch` only:
// Playwright never sees these requests, so the Basic credentials, Bearer tokens and refresh cookies
// stay out of every trace and report. Errors name the method and path, never a body or a header.
import { parseGroup, parseInviteLink } from '../../contract-tests/support/core-guards';
import { parseRegisterResponse } from '../../contract-tests/support/guards';

import type { E2eBasicAuth } from './config';
import { STAGING_API_ORIGIN } from './config';

export const REFRESH_COOKIE_NAME = '__Host-chipin_refresh';

const REQUEST_TIMEOUT_MS = 15_000;
const PREFLIGHT_TIMEOUT_MS = 10_000;

export interface ProvisionedUser {
    id: string;
    displayName: string;
    accessToken: string;
    /** The value of the host-only refresh cookie that test-register set. */
    refreshCookieValue: string;
}

export interface PurgeCounts {
    runId: string;
    deletedUsers: number;
    deletedGroups: number;
    deletedExpenses: number;
    deletedSettlements: number;
    deletedActivityEvents: number;
}

type FetchImpl = typeof fetch;

class E2eProvisioningError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const encodeBasicCredentials = ({ username, password }: E2eBasicAuth): string =>
    Buffer.from(`${username}:${password}`, 'utf8').toString('base64');

/**
 * The refresh cookie value of a test-register response. The cookie must keep the policy the app
 * relies on (host-only `Secure; HttpOnly; SameSite=Strict; Path=/`), as the contract smoke checks.
 */
export const readRefreshCookieValue = (setCookieHeaders: readonly string[]): string => {
    for (const header of setCookieHeaders) {
        const [pair = '', ...rawAttributes] = header.split(';').map(part => part.trim());
        const separatorIndex = pair.indexOf('=');

        if (separatorIndex <= 0 || pair.slice(0, separatorIndex) !== REFRESH_COOKIE_NAME) {
            continue;
        }

        const attributes = new Map<string, string | null>();

        for (const rawAttribute of rawAttributes) {
            const attributeSeparator = rawAttribute.indexOf('=');
            const name = (
                attributeSeparator === -1 ? rawAttribute : rawAttribute.slice(0, attributeSeparator)
            ).toLowerCase();
            const value =
                attributeSeparator === -1
                    ? null
                    : rawAttribute.slice(attributeSeparator + 1).toLowerCase();

            attributes.set(name, value);
        }

        const hasRequiredAttributes =
            attributes.get('secure') === null &&
            attributes.get('httponly') === null &&
            attributes.get('path') === '/' &&
            attributes.get('samesite') === 'strict' &&
            !attributes.has('domain');

        if (!hasRequiredAttributes) {
            throw new E2eProvisioningError(
                'Refresh cookie violates the required security attributes',
            );
        }

        const value = pair.slice(separatorIndex + 1);

        if (!value) {
            throw new E2eProvisioningError('Refresh cookie is empty');
        }

        return value;
    }

    throw new E2eProvisioningError('test-register did not set the refresh cookie');
};

const requireCount = (record: Record<string, unknown>, key: keyof PurgeCounts): number => {
    const value = record[key];

    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw new E2eProvisioningError(`purge.${key} must be a non-negative integer`);
    }

    return value;
};

export const parsePurgeCounts = (value: unknown, expectedRunId: string): PurgeCounts => {
    if (!isRecord(value)) {
        throw new E2eProvisioningError('purge response must be an object');
    }

    if (value.runId !== expectedRunId) {
        throw new E2eProvisioningError('purge response runId does not match the run');
    }

    return {
        runId: expectedRunId,
        deletedUsers: requireCount(value, 'deletedUsers'),
        deletedGroups: requireCount(value, 'deletedGroups'),
        deletedExpenses: requireCount(value, 'deletedExpenses'),
        deletedSettlements: requireCount(value, 'deletedSettlements'),
        deletedActivityEvents: requireCount(value, 'deletedActivityEvents'),
    };
};

export const formatPurgeCounts = (counts: PurgeCounts): string =>
    `run ${counts.runId}: users=${counts.deletedUsers} groups=${counts.deletedGroups} ` +
    `expenses=${counts.deletedExpenses} settlements=${counts.deletedSettlements} ` +
    `activityEvents=${counts.deletedActivityEvents}`;

/** A run id the staging purge accepts: `fe-e2e-<ms>-<hex>`. */
export const createRunId = (): string =>
    `fe-e2e-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

const RUN_ID_PATTERN = /^fe-e2e-\d{13}-[0-9a-f]{12}$/;

/** Whether `value` has the `createRunId` format (the CI workflow creates the same format). */
export const isRunId = (value: string): boolean => RUN_ID_PATTERN.test(value);

const retryOnce = <T>(action: () => Promise<T>): Promise<T> => action().catch(() => action());

/**
 * Purges the run (retried once on failure), then purges again (also retried once): that second,
 * idempotent call deleting no user proves no user of the run is left. Resolves with the counts of
 * the first purge; rejects when either purge fails twice or users are left.
 */
export const purgeAndVerify = async (
    client: Pick<ProvisioningClient, 'purge'>,
): Promise<PurgeCounts> => {
    const counts = await retryOnce(() => client.purge());
    const leftovers = await retryOnce(() => client.purge());

    if (leftovers.deletedUsers !== 0) {
        throw new E2eProvisioningError(
            `Run purge left users behind: ${formatPurgeCounts(leftovers)}`,
        );
    }

    return counts;
};

interface RequestOptions {
    method: 'DELETE' | 'GET' | 'POST';
    path: string;
    authorization: string | null;
    body?: unknown;
}

const send = (fetchImpl: FetchImpl, options: RequestOptions): Promise<Response> => {
    const description = `${options.method} ${options.path}`;
    const headers = new Headers({ Accept: 'application/json' });

    if (options.body !== undefined) {
        headers.set('Content-Type', 'application/json');
    }

    if (options.authorization) {
        headers.set('Authorization', options.authorization);
    }

    return fetchImpl(new URL(options.path, STAGING_API_ORIGIN), {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers,
        method: options.method,
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).then(
        response => {
            if (!response.ok) {
                throw new E2eProvisioningError(
                    `Staging API ${STAGING_API_ORIGIN}: ${description} failed with HTTP ${response.status}`,
                );
            }

            return response;
        },
        () => {
            throw new E2eProvisioningError(
                `Staging API ${STAGING_API_ORIGIN}: ${description} failed (network or timeout)`,
            );
        },
    );
};

/**
 * The invite token of a group read by id (GRP-015: every active member sees it). The token is a
 * credential: it is returned to the test only, never put in a message.
 */
export const readGroupInviteToken = (value: unknown): string => {
    // Throws unless the group, its token included, is valid; the narrowing below only types it.
    parseGroup(value);

    return isRecord(value) && typeof value.inviteToken === 'string' ? value.inviteToken : '';
};

const readJson = (response: Response, description: string): Promise<unknown> =>
    response.text().then(text => {
        try {
            return JSON.parse(text) as unknown;
        } catch {
            throw new E2eProvisioningError(`${description} returned invalid JSON`);
        }
    });

/**
 * Fails with a message that names the staging API when it is down, before any user is created.
 * An unauthenticated `GET /users/self` must answer 401: any answer proves less (a proxy page, a 5xx).
 */
export const assertStagingApiReachable = (fetchImpl: FetchImpl = fetch): Promise<void> =>
    fetchImpl(new URL('/users/self', STAGING_API_ORIGIN), {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS),
    }).then(
        response => {
            if (response.status !== 401) {
                throw new E2eProvisioningError(
                    `Staging API ${STAGING_API_ORIGIN} is unavailable: GET /users/self answered HTTP ${response.status} instead of 401`,
                );
            }
        },
        () => {
            throw new E2eProvisioningError(
                `Staging API ${STAGING_API_ORIGIN} is unreachable (network error or ${PREFLIGHT_TIMEOUT_MS / 1000} s timeout)`,
            );
        },
    );

export interface ProvisioningClient {
    register: (displayName: string) => Promise<ProvisionedUser>;
    makeFriends: (inviter: ProvisionedUser, invitee: ProvisionedUser) => Promise<void>;
    /** A group owned by `owner` with every `members` added; returns the group id. */
    createGroup: (
        owner: ProvisionedUser,
        name: string,
        members: readonly ProvisionedUser[],
    ) => Promise<string>;
    /** A USD expense paid by `payer`, split equally (AUTO) among `participants`. */
    addEqualGroupExpense: (input: {
        groupId: string;
        payer: ProvisionedUser;
        participants: readonly ProvisionedUser[];
        amount: number;
        description: string;
    }) => Promise<void>;
    /** The group's invite token (`GET /groups/{id}` as `member`), for the invite link. */
    getGroupInviteToken: (member: ProvisionedUser, groupId: string) => Promise<string>;
    purge: () => Promise<PurgeCounts>;
}

export const createProvisioningClient = (
    basicAuth: E2eBasicAuth,
    runId: string,
    fetchImpl: FetchImpl = fetch,
): ProvisioningClient => {
    const basicAuthorization = `Basic ${encodeBasicCredentials(basicAuth)}`;
    const bearer = (user: ProvisionedUser): string => `Bearer ${user.accessToken}`;

    const requestJson = (options: RequestOptions): Promise<unknown> =>
        send(fetchImpl, options).then(response =>
            readJson(response, `${options.method} ${options.path}`),
        );

    return {
        register: displayName =>
            send(fetchImpl, {
                authorization: basicAuthorization,
                body: { displayName, runId },
                method: 'POST',
                path: '/auth/test-register',
            }).then(response => {
                const refreshCookieValue = readRefreshCookieValue(response.headers.getSetCookie());

                return readJson(response, 'POST /auth/test-register').then(value => {
                    const registered = parseRegisterResponse(value);

                    if (registered.runId !== runId) {
                        throw new E2eProvisioningError(
                            'test-register runId does not match the requested run',
                        );
                    }

                    return {
                        id: registered.user.id,
                        displayName: registered.user.displayName,
                        accessToken: registered.accessToken,
                        refreshCookieValue,
                    };
                });
            }),
        makeFriends: (inviter, invitee) =>
            requestJson({
                authorization: bearer(inviter),
                method: 'POST',
                path: '/users/invite-link',
            })
                .then(value =>
                    requestJson({
                        authorization: bearer(invitee),
                        method: 'POST',
                        path: `/users/invite/${encodeURIComponent(parseInviteLink(value))}`,
                    }),
                )
                .then(() => undefined),
        createGroup: (owner, name, members) =>
            requestJson({
                authorization: bearer(owner),
                body: { name, simplifyDebts: false },
                method: 'POST',
                path: '/groups',
            }).then(value => {
                const groupId = parseGroup(value).id;

                return members
                    .reduce<Promise<unknown>>(
                        (previous, member) =>
                            previous.then(() =>
                                requestJson({
                                    authorization: bearer(owner),
                                    body: { userId: member.id },
                                    method: 'POST',
                                    path: `/groups/${encodeURIComponent(groupId)}/members`,
                                }),
                            ),
                        Promise.resolve(),
                    )
                    .then(() => groupId);
            }),
        addEqualGroupExpense: ({ groupId, payer, participants, amount, description }) =>
            requestJson({
                authorization: bearer(payer),
                body: {
                    type: 'EXPENSE',
                    groupId,
                    expense: {
                        description,
                        amount,
                        date: Math.floor(Date.now() / 1000),
                        payerId: payer.id,
                        participantIds: participants.map(participant => participant.id),
                        category: 'food',
                        currency: 'USD',
                        sharingMode: { type: 'AUTO' },
                    },
                },
                method: 'POST',
                path: '/ledger/entries',
            }).then(() => undefined),
        getGroupInviteToken: (member, groupId) =>
            requestJson({
                authorization: bearer(member),
                method: 'GET',
                path: `/groups/${encodeURIComponent(groupId)}`,
            }).then(readGroupInviteToken),
        purge: () =>
            requestJson({
                authorization: basicAuthorization,
                method: 'DELETE',
                path: `/auth/test-runs/${encodeURIComponent(runId)}`,
            }).then(value => parsePurgeCounts(value, runId)),
    };
};
