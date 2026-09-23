import { it } from 'vitest';

import type { ContractEnvironment } from './support/config';
import { resolveContractConfig } from './support/config';
import { hasExpectedAutoShares } from './support/core-expectations';
import {
    type ContractLedgerActivity,
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
import { assertOpenApiResponseFields } from './support/openapi';

const OPENAPI_RESPONSE_EXPECTATIONS = [
    { path: '/auth/test-register', method: 'post', status: '201', fields: [] },
    { path: '/auth/test-runs/{runId}', method: 'delete', status: '200', fields: [] },
    { path: '/users/self', method: 'get', status: '200', fields: ['isPremium'] },
    { path: '/users/self', method: 'get', status: '401', fields: ['code'] },
    { path: '/users/known-users', method: 'get', status: '200', fields: [] },
    { path: '/users/invite-link', method: 'post', status: '200', fields: [] },
    { path: '/users/invite/{inviteToken}', method: 'post', status: '200', fields: [] },
    { path: '/groups', method: 'get', status: '200', fields: ['nextCursor'] },
    { path: '/groups', method: 'get', status: '400', fields: ['code'] },
    { path: '/groups', method: 'post', status: '201', fields: ['simplifyDebts'] },
    { path: '/groups/{id}', method: 'get', status: '200', fields: [] },
    { path: '/groups/{id}/members', method: 'post', status: '200', fields: [] },
    { path: '/ledger/entries', method: 'post', status: '201', fields: ['participantShares'] },
    { path: '/ledger/entries/{id}', method: 'get', status: '200', fields: [] },
    { path: '/ledger/entries/{id}', method: 'get', status: '404', fields: ['code'] },
    { path: '/dashboard', method: 'get', status: '200', fields: [] },
    { path: '/users/self/activities', method: 'get', status: '200', fields: ['nextCursor'] },
    { path: '/users/self/activity-previews', method: 'get', status: '200', fields: ['nextCursor'] },
    { path: '/groups/{groupId}/activity-previews', method: 'get', status: '200', fields: ['nextCursor'] },
    { path: '/currency-rates', method: 'get', status: '200', fields: ['stale'] },
] as const;

const FULL_MATRIX_TIMEOUT_MS =const FULL_MATRIX_TIMEOUT_MS = 6 * 60_000;

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
    let expenseId: string | null = null;
    let settlementId: string | null = null;
    let primaryFailure: unknown;
    let hasPrimaryFailure = false;

    const hasExpectedParticipants = (
        participantIds: readonly string[],
        expectedParticipants: Set<string>,
    ): boolean => {
        const uniqueParticipantIds = new Set(participantIds);
        return (
            participantIds.length === expectedParticipants.size &&
            uniqueParticipantIds.size === expectedParticipants.size &&
            [...expectedParticipants].every(id => uniqueParticipantIds.has(id))
        );
    };

    const isExpectedLedgerActivity = (
        activity: ContractLedgerActivity,
        a: ContractRegisterResponse,
        b: ContractRegisterResponse,
        expectedExpenseId: string,
        expectedSettlementId: string,
    ): boolean => {
        if (activity.type === 'EXPENSE') {
            const expectedParticipants = new Set([a.user.id, b.user.id]);
            const expectedDisplayNames = new Map([
                [a.user.id, a.user.displayName],
                [b.user.id, b.user.displayName],
            ]);
            return (
                activity.entryId === expectedExpenseId &&
                activity.amount === 12.5 &&
                activity.currency === 'USD' &&
                activity.payerId === a.user.id &&
                activity.payerDisplayName === a.user.displayName &&
                hasExpectedAutoShares(activity.shares, expectedParticipants, {
                    shareAmount: 6.25,
                    currency: 'USD',
                }) &&
                activity.shares.every(
                    share => expectedDisplayNames.get(share.userId) === share.displayName,
                )
            );
        }

        return (
            activity.entryId === expectedSettlementId &&
            activity.amount === 5 &&
            activity.currency === 'USD' &&
            activity.actorUserId === a.user.id &&
            activity.payerId === b.user.id &&
            activity.fromDisplayName === b.user.displayName &&
            activity.toDisplayName === a.user.displayName
        );
    };

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
            assertOpenApiResponseFields(document, OPENAPI_RESPONSE_EXPECTATIONS);
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
            const knownUsers = parseKnownUsers(value);
            if (knownUsers.length !== 1 || knownUsers[0]?.id !== b.user.id) {
                throw new Error('Known-user response must contain exactly provisioned user B');
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
            if (
                group.name !== 'Contract Group A' ||
                group.description !== 'Primary contract group' ||
                group.simplifyDebts !== false ||
                group.role !== 'OWNER' ||
                group.creatorId !== requireState(userA, 'user A').user.id
            ) {
                throw new Error('Created group A does not match the requested properties');
            }
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
            const a = requireState(userA, 'user A');
            const b = requireState(userB, 'user B');
            const group = parseGroup(value);
            if (!hasExpectedParticipants(group.memberIds, new Set([a.user.id, b.user.id]))) {
                throw new Error('Group member response must contain exactly the two run-scoped users');
            }
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                body: { name: 'Contract Group B', simplifyDebts: true },
                method: 'POST',
                path: '/groups',
            });
        })
        .then(value => {
            const group = parseGroup(value);
            if (
                group.name !== 'Contract Group B' ||
                group.description !== null ||
                group.simplifyDebts !== true ||
                group.role !== 'OWNER' ||
                group.creatorId !== requireState(userA, 'user A').user.id
            ) {
                throw new Error('Created group B does not match the requested properties');
            }
            groupB = group.id;
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
            if (next.ids.length !== 1 || next.ids[0] === first.ids[0]) {
                throw new Error('Group cursor must advance to one distinct group');
            }
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
            const a = requireState(userA, 'user A');
            const b = requireState(userB, 'user B');
            const expectedParticipants = new Set([a.user.id, b.user.id]);
            if (
                expense.type !== 'EXPENSE' ||
                expense.scope !== 'GROUP' ||
                expense.groupId !== groupA ||
                expense.amount !== 12.5 ||
                expense.currency !== 'USD' ||
                expense.payerId !== a.user.id ||
                !hasExpectedParticipants(expense.participantIds, expectedParticipants) ||
                !hasExpectedAutoShares(expense.participantShares, expectedParticipants, {
                    shareAmount: 6.25,
                    currency: 'USD',
                })
            ) {
                throw new Error('Created expense does not match the requested financial contract');
            }
            expenseId = expense.id;
            return client
                .requestJson({
                    auth: { kind: 'bearer', token: a.accessToken },
                    method: 'GET',
                    path: `/ledger/entries/${encodeURIComponent(expense.id)}`,
                })
                .then(read => {
                    const persisted = parseLedgerEntry(read);
                    if (
                        persisted.type !== 'EXPENSE' ||
                        persisted.scope !== 'GROUP' ||
                        persisted.id !== expense.id ||
                        persisted.groupId !== groupA ||
                        persisted.amount !== 12.5 ||
                        persisted.currency !== 'USD' ||
                        persisted.payerId !== a.user.id ||
                        !hasExpectedParticipants(persisted.participantIds, expectedParticipants) ||
                        !hasExpectedAutoShares(persisted.participantShares, expectedParticipants, {
                            shareAmount: 6.25,
                            currency: 'USD',
                        })
                    ) {
                        throw new Error('Expense read does not preserve the requested financial contract');
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
            const a = requireState(userA, 'user A');
            const b = requireState(userB, 'user B');
            if (
                settlement.type !== 'SETTLEMENT' ||
                settlement.scope !== 'GROUP' ||
                settlement.groupId !== groupA ||
                settlement.amount !== 5 ||
                settlement.currency !== 'USD' ||
                settlement.fromUserId !== b.user.id ||
                settlement.toUserId !== a.user.id
            ) {
                throw new Error('Created settlement does not match the requested financial contract');
            }
            settlementId = settlement.id;
            return client
                .requestJson({
                    auth: { kind: 'bearer', token: a.accessToken },
                    method: 'GET',
                    path: `/ledger/entries/${encodeURIComponent(settlement.id)}`,
                })
                .then(read => {
                    const persisted = parseLedgerEntry(read);
                    if (
                        persisted.type !== 'SETTLEMENT' ||
                        persisted.scope !== 'GROUP' ||
                        persisted.id !== settlement.id ||
                        persisted.groupId !== groupA ||
                        persisted.amount !== 5 ||
                        persisted.currency !== 'USD' ||
                        persisted.fromUserId !== b.user.id ||
                        persisted.toUserId !== a.user.id
                    ) {
                        throw new Error('Settlement read does not preserve the requested financial contract');
                    }
                });
        })
        .then(() => {
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: `/groups/${encodeURIComponent(requireState(groupA, 'group A'))}`,
            });
        })
        .then(value => {
            const group = parseGroup(value);
            const b = requireState(userB, 'user B');
            const bUsdBalance = group.memberBalancesByUserId[b.user.id]?.USD;
            if (
                !bUsdBalance ||
                bUsdBalance.currency !== 'USD' ||
                bUsdBalance.netBalance !== 1.25
            ) {
                throw new Error(
                    'Refetched group USD member balance must equal the generated +1.25 creditor position',
                );
            }
            const a = requireState(userA, 'user A');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: '/dashboard',
            });
        })
        .then(value => {
            const dashboard = parseDashboard(value);
            const usdBalance = dashboard.balances.USD;
            if (!usdBalance || usdBalance.currency !== 'USD' || usdBalance.netBalance !== 1.25) {
                throw new Error('Dashboard USD balance must reflect the generated expense and settlement');
            }
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
            const generatedLedgerIds = new Set([
                requireState(expenseId, 'expense'),
                requireState(settlementId, 'settlement'),
            ]);
            const activityLedgerIds = new Set([
                ...first.ledgerEntryIds,
                ...next.ledgerEntryIds,
            ]);
            if (
                activityLedgerIds.size !== generatedLedgerIds.size ||
                [...generatedLedgerIds].some(id => !activityLedgerIds.has(id))
            ) {
                throw new Error(
                    'User activity cursor pages must contain the generated expense and settlement',
                );
            }
            const a = requireState(userA, 'user A');
            const b = requireState(userB, 'user B');
            const activityLedgerMetadata = [...first.ledgerActivities, ...next.ledgerActivities];
            if (
                activityLedgerMetadata.length !== 2 ||
                activityLedgerMetadata.some(
                    activity =>
                        !isExpectedLedgerActivity(
                            activity,
                            a,
                            b,
                            requireState(expenseId, 'expense'),
                            requireState(settlementId, 'settlement'),
                        ),
                )
            ) {
                throw new Error('User activity metadata must match the generated ledger values');
            }
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
            const generatedLedgerIds = new Set([
                requireState(expenseId, 'expense'),
                requireState(settlementId, 'settlement'),
            ]);
            const previewLedgerIds = new Set([
                ...first.ledgerEntryIds,
                ...next.ledgerEntryIds,
            ]);
            if (
                previewLedgerIds.size !== generatedLedgerIds.size ||
                [...generatedLedgerIds].some(id => !previewLedgerIds.has(id))
            ) {
                throw new Error(
                    'User activity-preview cursor pages must contain the generated expense and settlement',
                );
            }
            const a = requireState(userA, 'user A');
            const b = requireState(userB, 'user B');
            const previewLedgerMetadata = [...first.ledgerActivities, ...next.ledgerActivities];
            if (
                previewLedgerMetadata.length !== 2 ||
                previewLedgerMetadata.some(
                    activity =>
                        !isExpectedLedgerActivity(
                            activity,
                            a,
                            b,
                            requireState(expenseId, 'expense'),
                            requireState(settlementId, 'settlement'),
                        ),
                )
            ) {
                throw new Error('User activity-preview metadata must match the generated ledger values');
            }
            const renderedPreviewMetadata = [
                ...first.renderedLedgerActivities,
                ...next.renderedLedgerActivities,
            ];
            if (
                renderedPreviewMetadata.length !== 2 ||
                renderedPreviewMetadata.some(
                    activity =>
                        !isExpectedLedgerActivity(
                            activity,
                            a,
                            b,
                            requireState(expenseId, 'expense'),
                            requireState(settlementId, 'settlement'),
                        ),
                )
            ) {
                throw new Error(
                    'User activity-preview lastEvent metadata must match the generated ledger values',
                );
            }
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: `/groups/${encodeURIComponent(requireState(groupA, 'group A'))}/activity-previews?limit=1`,
            });
        })
        .then(value => {
            const groupPreview = parseActivityPreviewPage(value);
            const generatedLedgerIds = new Set([
                requireState(expenseId, 'expense'),
                requireState(settlementId, 'settlement'),
            ]);
            if (
                groupPreview.ids.length !== 1 ||
                !groupPreview.ledgerEntryIds.some(id => generatedLedgerIds.has(id))
            ) {
                throw new Error('Group preview feed is missing generated ledger activity');
            }
            const a = requireState(userA, 'user A');
            const b = requireState(userB, 'user B');
            if (
                groupPreview.ledgerActivities.length !== 1 ||
                !isExpectedLedgerActivity(
                    groupPreview.ledgerActivities[0],
                    a,
                    b,
                    requireState(expenseId, 'expense'),
                    requireState(settlementId, 'settlement'),
                )
            ) {
                throw new Error('Group preview metadata must match the generated ledger values');
            }
            if (
                groupPreview.renderedLedgerActivities.length !== 1 ||
                !isExpectedLedgerActivity(
                    groupPreview.renderedLedgerActivities[0],
                    a,
                    b,
                    requireState(expenseId, 'expense'),
                    requireState(settlementId, 'settlement'),
                )
            ) {
                throw new Error(
                    'Group preview lastEvent metadata must match the generated ledger values',
                );
            }
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
            const b = requireState(userB, 'user B');
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                body: {
                    type: 'EXPENSE',
                    expense: {
                        description: 'Direct contract taxi',
                        amount: 8,
                        date: Math.floor(Date.now() / 1000),
                        payerId: a.user.id,
                        participantIds: [a.user.id, b.user.id],
                        category: 'transport',
                        currency: 'USD',
                        sharingMode: { type: 'AUTO' },
                    },
                },
                method: 'POST',
                path: '/ledger/entries',
            });
        })
        .then(value => {
            const directExpense = parseLedgerEntry(value);
            const a = requireState(userA, 'user A');
            const b = requireState(userB, 'user B');
            const expectedParticipants = new Set([a.user.id, b.user.id]);
            if (
                directExpense.type !== 'EXPENSE' ||
                directExpense.scope !== 'USER' ||
                directExpense.groupId !== null ||
                directExpense.amount !== 8 ||
                directExpense.currency !== 'USD' ||
                directExpense.payerId !== a.user.id ||
                !hasExpectedParticipants(directExpense.participantIds, expectedParticipants) ||
                !hasExpectedAutoShares(directExpense.participantShares, expectedParticipants, {
                    shareAmount: 4,
                    currency: 'USD',
                })
            ) {
                throw new Error('Direct expense does not match the requested user-scope contract');
            }
            return client.requestJson({
                auth: { kind: 'bearer', token: a.accessToken },
                method: 'GET',
                path: '/users/known-users',
            });
        })
        .then(value => {
            const b = requireState(userB, 'user B');
            const knownUsers = parseKnownUsers(value);
            const knownUser = knownUsers[0];
            if (
                knownUsers.length !== 1 ||
                knownUser?.id !== b.user.id ||
                knownUser.balancesByCurrency.USD !== 4 ||
                knownUser.lastUsedCurrency !== 'USD'
            ) {
                throw new Error('Known-user USD balance must reflect the generated direct expense');
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
}, FULL_MATRIX_TIMEOUT_MS);
