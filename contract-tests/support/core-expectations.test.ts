import { describe, expect, it } from 'vitest';

import { hasExpectedAutoShares } from './core-expectations';

describe('hasExpectedAutoShares', () => {
    it('accepts the requested per-user share amount for a direct expense', () => {
        const expectedParticipants = new Set(['user-a', 'user-b']);

        expect(
            hasExpectedAutoShares(
                [
                    { userId: 'user-a', shareAmount: 4, currency: 'USD' },
                    { userId: 'user-b', shareAmount: 4, currency: 'USD' },
                ],
                expectedParticipants,
                { shareAmount: 4, currency: 'USD' },
            ),
        ).toBe(true);
    });

    it.each([
        {
            label: 'wrong amount',
            shares: [
                { userId: 'user-a', shareAmount: 6.25, currency: 'USD' },
                { userId: 'user-b', shareAmount: 6.25, currency: 'USD' },
            ],
        },
        {
            label: 'duplicate participant',
            shares: [
                { userId: 'user-a', shareAmount: 4, currency: 'USD' },
                { userId: 'user-a', shareAmount: 4, currency: 'USD' },
            ],
        },
        {
            label: 'missing participant',
            shares: [{ userId: 'user-a', shareAmount: 4, currency: 'USD' }],
        },
    ])('rejects $label', ({ shares }) => {
        expect(
            hasExpectedAutoShares(shares, new Set(['user-a', 'user-b']), {
                shareAmount: 4,
                currency: 'USD',
            }),
        ).toBe(false);
    });
});
