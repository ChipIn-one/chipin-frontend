import { expect, test } from 'vitest';

import { TEST_INVITE_TOKEN } from 'test/fixtures/inviteToken';

import { INVITE_TOKEN_PATTERN as SITE_INVITE_TOKEN_PATTERN } from '../../../site/src/lib/inviteToken';

import { INVITE_TOKEN_PATTERN, isInviteToken } from './inviteToken';

// Spec 04 §3.5: the site invite landing copies this regex; an app-only change must fail here too,
// since app-mode CI does not run the site tests (KB USR-081, USR-082).
test('USR-081 the app and the site use the same invite token regex', () => {
    expect(INVITE_TOKEN_PATTERN.source).toBe(SITE_INVITE_TOKEN_PATTERN.source);
    expect(INVITE_TOKEN_PATTERN.flags).toBe(SITE_INVITE_TOKEN_PATTERN.flags);
});

test('accepts a backend-shaped base64url invite token', () => {
    expect(isInviteToken(TEST_INVITE_TOKEN)).toBe(true);
});

test.each([undefined, '', 'abc', 'a'.repeat(65), '../x', 'a%2Fb', 'a.b', 'a b'])(
    'rejects malformed invite token %j',
    value => {
        expect(isInviteToken(value)).toBe(false);
    },
);
