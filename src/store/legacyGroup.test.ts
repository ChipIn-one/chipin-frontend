import * as Sentry from '@sentry/react';
import { expect, test, vi } from 'vitest';

import { currencyCode, fromUnits } from 'shared/money';
import { domainPreview, legacyPreview } from 'test/activityFixtures';
import { groupUser, wireGroup } from 'test/groupFixtures';

import { domainGroupFromLegacy } from './legacyGroup';

vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));

test('carries a group a legacy write returned into the domain group, balances as Money', () => {
    const friend = groupUser('friend');
    const legacy = wireGroup('g-1', {
        members: [
            { user: groupUser('g-1-owner'), balancesByCurrency: {} },
            {
                user: friend,
                balancesByCurrency: {
                    USD: { currency: 'USD', netBalance: -12.3456 },
                    EUR: { currency: 'EUR', netBalance: 0.1 },
                },
            },
        ],
        recentActivities: { items: [legacyPreview('p1')], nextCursor: 4 },
    });

    const group = domainGroupFromLegacy(legacy);

    expect(group.members[1]).toEqual({
        user: friend,
        balancesByCurrency: {
            USD: { net: fromUnits(-123_456n, currencyCode('USD')) },
            EUR: { net: fromUnits(1_000n, currencyCode('EUR')) },
        },
    });
    expect(group.recentActivities).toEqual({ items: [domainPreview('p1')], nextCursor: 4 });
    expect(group).toMatchObject({ id: 'g-1', name: legacy.name, role: 'OWNER' });
});

test('leaves an unreadable legacy balance out and reports it', () => {
    const group = domainGroupFromLegacy(
        wireGroup('g-1', {
            members: [
                {
                    user: groupUser('friend'),
                    balancesByCurrency: {
                        XX: { currency: 'XX', netBalance: 5 },
                        USD: { currency: 'USD', netBalance: 2 },
                    },
                },
            ],
        }),
    );

    expect(group.members[0]?.balancesByCurrency).toEqual({
        USD: { net: fromUnits(20_000n, currencyCode('USD')) },
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'money.legacy_reject',
        expect.objectContaining({ tags: { 'money.reason': 'currency' } }),
    );
});
