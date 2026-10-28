import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';
import { expect, test } from 'vitest';

import { isInviteToken } from './inviteToken';

test('accepts a backend-shaped base64url invite token', () => {
    expect(isInviteToken(TEST_INVITE_TOKEN)).toBe(true);
});

test.each([undefined, '', 'abc', 'a'.repeat(65), '../x', 'a%2Fb', 'a.b', 'a b'])(
    'rejects malformed invite token %j',
    value => {
        expect(isInviteToken(value)).toBe(false);
    },
);
