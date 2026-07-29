import { expect, test } from 'vitest';

import { ACTIVITY_ACTIONS } from 'constants/activity';

import { hasLedgerEntryReversedEvent } from './helpers';

test.each([
    ACTIVITY_ACTIONS.EXPENSE_REVERSED,
    ACTIVITY_ACTIONS.SETTLEMENT_REVERSED,
])('detects a %s subevent', action => {
    expect(
        hasLedgerEntryReversedEvent([
            { action: ACTIVITY_ACTIONS.EXPENSE_CREATED },
            { action },
        ]),
    ).toBe(true);
});

test('returns false when a reversed subevent is absent', () => {
    expect(
        hasLedgerEntryReversedEvent([
            { action: ACTIVITY_ACTIONS.EXPENSE_CREATED },
        ]),
    ).toBe(false);
});
