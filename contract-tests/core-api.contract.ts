import { it } from 'vitest';

import type { ContractEnvironment } from './support/config';
import { resolveContractConfig } from './support/config';
import {
    parseActivityPage,
    parseActivityPreviewPage,
    parseCurrencyRates,
    parseDashboard,
    parseErrorCode,
    parseGroup,
    parseGroupPage,
    parseInviteLink,
    parseKnownUsers,
    parseLedgerEntry,
    parseSelfUserContract,
} from './support/core-guards';
import { type ContractRegisterResponse, parseRegisterResponse } from './support/guards';
import { createContractHttpClient } from './support/http';

const OPENAPI_PATHS = [
    '/auth/test-register',
    '/users/self',
    '/users/known-users',
    '/users/invite-link',
    '/users/invite/{inviteToken}',
    '/groups',
    '/groups/{id}/members',
    '/ledger/entries',
    '/ledger/entries/{id}',
    '/dashboard',
    '/users/self/activities',
    '/users/self/activity-previews',
    '/groups/{groupId}/activity-previews',
    '/currency-rates',
] as const;

const OPENAPI_FIELDS = [
    'isPremium',
    'simplifyDebts',
    'participantShares',
    'nextCursor',
    'stale',
    'code',
] as const;

const readEnvironment = (key: keyof ContractEnvironment): string | undefined => {
    const processValue: unknown = Reflect.get(globalThis, 'process');
    if (typeof processValue !== 'object' || processValue === null) {
        throw new Error('Contract tests require a Node process environment');
    }
    const env: unknown = Reflect.get(processValue, 'env');
    if (typeof env !== 'object' || env === null) {
        throw new Error('Contract tests require a Node process environment');
    }
    const value: unknown = Reflect.get(env, key);
    return typeof value === 'string' ? value : undefined;
};

const requireState = <T>(value: T | null, label: string): T => {
    if (value === null) {
        throw new Error(`${label} state is unavailable`);
    }
    return value;
};

it('validates the live core API contract matrix', () => {
    const config = resolveContractConfig({
        CHIPIN_CONTRACT_BASE_URL: readEnvironment('CHIPIN_CONTRACT_BASE_URL'),
        CHIPIN_CONTRACT_SWAGGER_USER: readEnvironment('CHIPIN_CONTRACT_SWAGGER_USER'),
        CHIPIN_CONTRACT_SWAGGER_PASSWORD: readEnvironment('CHIPIN_CONTRACT_SWAGGER_PASSWORD'),
    });
    const client = createContractHttpClient(config);
    const runId = `fe-full-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    let provisionAttempted = false;
    let userA: ContractRegisterResponse | null = null;
    let userB: ContractRegisterResponse | null = null;
    let groupA: string | null = null;
    let groupB: string | null = null;
    let primaryFailure: unknown;
    let hasPrimaryFailure = false;

    const register = (displayName: string): Promise<ContractRegisterResponse> => {
        provisionAttempted = true;
        return client
            .requestJson({
                auth: { kind: 'basic' },
                body: { displayName, runId },
                method: 'POST',
                path: '/auth/test-register',
            })
            .then(value => {
                const response = parseRegisterResponse(value);
                if (response.runId !== runId) {
                    throw new Error('Provisioning response runId does not match the requested run');
                }
                return response;
            });
    };

    return client
        .requestText({
            auth: { kind: 'basic' },
            method: 'GET',
            path: '/swagger/documentation.yaml',
        })
        .then(document => {
            for (const path of OPENAPI_PATHS) {
                if (!document.includes(path)) {
                    throw new Error(`Runtime OpenAPI is missing required path ${path}`);
                }
            }
            for (const field of OPENAPI_FIELDS) {
                if (!document.includes(field)) {
                    throw new Error(`Runtime OpenAPI is missing required field ${field}`);
                }
            }
            return client.requestJsonForStatus(
                { auth: { kind: 'none' }, method: 'GET', path: '/users/self' },
                401,
            );
        })
        .then(value => {
            if (parseErrorCode(value).code !== 'AUTH.UNAUTHORIZED') {
                throw new Error('Unauthenticated self request must return AUTH.UNAUTHORIZED');
            }
            return register('FE Contract A');
        })
        .then(value => {
            userA = value;
            return register('FE Contract B');
        })
        .then(value => {
            userB = value;
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: '/users/self',
            });
        })
        .then(value => {
            const self = parseSelfUserContract(value);
            const a = requireState(userA, 'user A');
            if (self.id !== a.user.id) {
                throw new Error('Authenticated self user does not match provisioned user A');
            }
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'POST',
                path: '/users/invite-link',
            });
        })
        .then(value => {
            const token = parseInviteLink(value);
            const b = requireState(userB, 'user B');
            return client.requestJson({
                auth: { kind: 'bearer', token: b.accessToken },
                method: 'POST',
                path: `/users/invite/${encodeURIComponent(token)}`,
            });
        })
        .then(() => {
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: '/users/known-users',
            });
        })
        .then(value => {
            const b = requireState(userB, 'user B');
            if (!parseKnownUsers(value).includes(b.user.id)) {
                throw new Error('Known-user response is missing provisioned user B');
            }
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                body: {
                    name: 'Contract Group A',
                    description: 'Primary contract group',
                    simplifyDebts: false,
                },
                method: 'POST',
                path: '/groups',
            });
        })
        .then(value => {
            const group = parseGroup(value);
            groupA = group.id;
            const a = requireState(userA, 'user A');
            const b = requireState(userB, 'user B');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                body: { userId: b.user.id },
                method: 'POST',
                path: `/groups/${encodeURIComponent(group.id)}/members`,
            });
        })
        .then(value => {
            const b = requireState(userB, 'user B');
            if (!parseGroup(value).memberIds.includes(b.user.id)) {
                throw new Error('Group member response is missing provisioned user B');
            }
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                body: { name: 'Contract Group B', simplifyDebts: true },
                method: 'POST',
                path: '/groups',
            });
        })
        .then(value => {
            groupB = parseGroup(value).id;
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: '/groups?limit=1',
            });
        })
        .then(value => {
            const first = parseGroupPage(value);
            if (first.ids.length !== 1 || typeof first.nextCursor !== 'string') {
                throw new Error('Two fresh groups must produce an opaque group cursor');
            }
            const a = requireState(userA, 'user A');
            return client
                .requestJson({
                    auth: { kind: 'bearer', token: a.accessToken },
                    method: 'GET',
                    path: `/groups?limit=1&cursor=${encodeURIComponent(first.nextCursor)}`,
                })
                .then(next => ({ first, next: parseGroupPage(next) }));
        })
        .then(({ first, next }) => {
            const ids = new Set([...first.ids, ...next.ids]);
            if (!ids.has(requireState(groupA, 'group A')) || !ids.has(requireState(groupB, 'group B'))) {
                throw new Error('Group cursor pages do not contain both generated groups');
            }
            const a = requireState(userA, 'user A');
            const b = requireState(userB, 'user B');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                body: {
                    type: 'EXPENSE',
                    groupId: requireState(groupA, 'group A'),
                    expense: {
                        description: 'Contract dinner',
                        amount: 12.5,
                        date: Math.floor(Date.now() / 1000),
                        payerId: a.user.id,
                        participantIds: [a.user.id, b.user.id],
                        category: 'food',
                        currency: 'USD',
                        sharingMode: { type: 'AUTO' },
                    },
                },
                method: 'POST',
                path: '/ledger/entries',
            });
        })
        .then(value => {
            const expense = parseLedgerEntry(value);
            if (expense.type !== 'EXPENSE' || expense.groupId !== groupA) {
                throw new Error('Created expense does not match its generated group');
            }
            const a = requireState(userA, 'user A');
            return client
                .requestJson({
                    auth: { kind: 'bearer', token: a.accessToken },
                    method: 'GET',
                    path: `/ledger/entries/${encodeURIComponent(expense.id)}`,
                })
                .then(read => {
                    if (parseLedgerEntry(read).id !== expense.id) {
                        throw new Error('Expense read returned a different ledger entry');
                    }
                });
        })
        .then(() => {
            const a = requireState(userA, 'user A');
            const b = requireState(userB, 'user B');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                body: {
                    type: 'SETTLEMENT',
                    groupId: requireState(groupA, 'group A'),
                    settlement: {
                        fromUserId: b.user.id,
                        toUserId: a.user.id,
                        amount: 5,
                        currency: 'USD',
                    },
                },
                method: 'POST',
                path: '/ledger/entries',
            });
        })
        .then(value => {
            const settlement = parseLedgerEntry(value);
            if (settlement.type !== 'SETTLEMENT' || settlement.groupId !== groupA) {
                throw new Error('Created settlement does not match its generated group');
            }
            const a = requireState(userA, 'user A');
            return client
                .requestJson({
                    auth: { kind: 'bearer', token: a.accessToken },
                    method: 'GET',
                    path: `/ledger/entries/${encodeURIComponent(settlement.id)}`,
                })
                .then(read => {
                    if (parseLedgerEntry(read).id !== settlement.id) {
                        throw new Error('Settlement read returned a different ledger entry');
                    }
                });
        })
        .then(() => {
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: '/dashboard',
            });
        })
        .then(value => {
            parseDashboard(value);
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: '/users/self/activities?limit=1',
            });
        })
        .then(value => {
            const first = parseActivityPage(value);
            if (first.ids.length !== 1 || typeof first.nextCursor !== 'number') {
                throw new Error('Generated events must produce a numeric activity cursor');
            }
            const a = requireState(userA, 'user A');
            return client
                .requestJson({
                    auth: { kind: 'bearer', token: a.accessToken },
                    method: 'GET',
                    path: `/users/self/activities?limit=1&cursor=${first.nextCursor}`,
                })
                .then(next => ({ first, next: parseActivityPage(next) }));
        })
        .then(({ first, next }) => {
            if (next.ids.length !== 1 || next.ids[0] === first.ids[0]) {
                throw new Error('Activity cursor must advance to another generated event');
            }
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: '/users/self/activity-previews?limit=1',
            });
        })
        .then(value => {
            const first = parseActivityPreviewPage(value);
            if (first.ids.length !== 1 || typeof first.nextCursor !== 'number') {
                throw new Error('Expense and settlement must produce preview pagination');
            }
            const a = requireState(userA, 'user A');
            return client
                .requestJson({
                    auth: { kind: 'bearer', token: a.accessToken },
                    method: 'GET',
                    path: `/users/self/activity-previews?limit=1&cursor=${first.nextCursor}`,
                })
                .then(next => ({ first, next: parseActivityPreviewPage(next) }));
        })
        .then(({ first, next }) => {
            if (next.ids.length !== 1 || next.ids[0] === first.ids[0]) {
                throw new Error('Activity-preview cursor must advance to another generated preview');
            }
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: `/groups/${encodeURIComponent(requireState(groupA, 'group A'))}/activity-previews?limit=1`,
            });
        })
        .then(value => {
            if (parseActivityPreviewPage(value).ids.length !== 1) {
                throw new Error('Group preview feed is missing generated ledger activity');
            }
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: '/currency-rates?base=USD&currencies=EUR',
            });
        })
        .then(value => {
            if (parseCurrencyRates(value).base !== 'USD') {
                throw new Error('Currency rates must retain the requested USD base');
            }
            const a = requireState(userA, 'user A');
            return client.requestJsonForStatus(
                { auth: { kind: 'bearer', token: a.accessToken }, method: 'GET', path: '/groups?limit=0' },
                400,
            );
        })
        .then(value => {
            const error = parseErrorCode(value);
            if (error.code !== 'VALIDATION.INVALID' || error.details?.limit === undefined) {
                throw new Error('Invalid group limit must return field-level VALIDATION.INVALID');
            }
            const a = requireState(userA, 'user A');
            return client.requestJsonForStatus(
                {
                    auth: { kind: 'bearer', token: a.accessToken },
                    method: 'GET',
                    path: '/ledger/entries/ffffffff-ffff-4fff-8fff-ffffffffffff',
                },
                404,
            );
        })
        .then(value => {
            if (parseErrorCode(value).code !== 'LEDGER.NOT_FOUND') {
                throw new Error('Unknown ledger entry must return LEDGER.NOT_FOUND');
            }
        })
        .catch((error: unknown) => {
            hasPrimaryFailure = true;
            primaryFailure = error;
            throw error;
        })
        .finally(() => {
            if (!provisionAttempted) {
                return undefined;
            }
            return client
                .requestJson({
                    auth: { kind: 'basic' },
                    method: 'DELETE',
                    path: `/auth/test-runs/${encodeURIComponent(runId)}`,
                })
                .then(() => undefined)
                .catch((cleanupError: unknown) => {
                    if (hasPrimaryFailure) {
                        throw new AggregateError(
                            [primaryFailure, cleanupError],
                            'Contract matrix failed and cleanup also failed',
                        );
                    }
                    throw cleanupError;
                });
        });
});
