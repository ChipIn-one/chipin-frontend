import * as Sentry from '@sentry/react';
import { expect, test, vi } from 'vitest';

import type { components } from 'shared/api/generated/schema';
import { createWireAmount, currencyCode, fromUnits } from 'shared/money';

import { toGroup, toGroupsListPage } from './toGroup';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

type GroupResponse = components['schemas']['GroupResponse'];

const wireUser = (id: string) => ({
    id,
    email: `${id}@example.com`,
    displayName: `User ${id}`,
    createdAt: 1,
    updatedAt: 2,
});

const balance = (currency: string, amount: string) => ({
    currency,
    netBalance: createWireAmount(amount),
});

const response = (overrides: Partial<GroupResponse> = {}): GroupResponse => ({
    id: 'g-1',
    name: 'Trip',
    inviteToken: 'invite',
    creator: wireUser('owner'),
    members: [
        { user: wireUser('owner'), balancesByCurrency: {} },
        {
            user: wireUser('friend'),
            balancesByCurrency: {
                USD: balance('USD', '899999999999.9997'),
                EUR: balance('EUR', '-25.5'),
            },
        },
    ],
    createdAt: 10,
    updatedAt: 20,
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: 'USD',
    recentActivities: { items: [], nextCursor: null },
    ...overrides,
});

test('GRP maps a group to the domain with exact Money member balances, also beyond 2^39', () => {
    const group = toGroup(response());

    expect(group).toMatchObject({
        id: 'g-1',
        description: null,
        coverUrl: null,
        role: 'OWNER',
        lastUsedCurrency: 'USD',
        recentActivities: { items: [], nextCursor: null },
    });
    expect(group.creator).toEqual({
        ...wireUser('owner'),
        firstName: null,
        lastName: null,
        picture: null,
    });
    expect(group.members.map(member => member.balancesByCurrency)).toEqual([
        {},
        {
            USD: { net: fromUnits(8_999_999_999_999_997n, currencyCode('USD')) },
            EUR: { net: fromUnits(-255_000n, currencyCode('EUR')) },
        },
    ]);
});

test('leaves an unreadable member balance out and reports it without user data', () => {
    const group = toGroup(
        response({
            members: [
                {
                    user: wireUser('friend'),
                    balancesByCurrency: {
                        USD: balance('USD', '1e-7'),
                        XX: balance('XX', '1'),
                        EUR: balance('EUR', '2'),
                    },
                },
            ],
        }),
    );

    expect(group.members[0]?.balancesByCurrency).toEqual({
        EUR: { net: fromUnits(20_000n, currencyCode('EUR')) },
    });
    const reported = JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls);

    expect(reported).not.toContain('friend');
    expect(reported).not.toContain('1e-7');
});

test('maps a page of the groups list, keeping its opaque cursor', () => {
    expect(toGroupsListPage({ items: [response()], nextCursor: 'opaque' })).toEqual({
        items: [toGroup(response())],
        nextCursor: 'opaque',
    });
});
