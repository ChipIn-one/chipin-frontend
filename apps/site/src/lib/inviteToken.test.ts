import { describe, expect, test } from 'vitest';

import { INVITE_TOKEN_PATTERN as APP_INVITE_TOKEN_PATTERN } from '../../../app/src/helpers/inviteToken';

import { INVITE_TOKEN_PATTERN } from './inviteToken';

// Spec 04 §3.5: the site copies the app's token regex; a mismatch would offer the app a token it
// rejects, or hide the button for a token it accepts (KB USR-081, USR-082).
describe('invite token format', () => {
    test('USR-081 the site and the app use the same invite token regex', () => {
        expect(INVITE_TOKEN_PATTERN.source).toBe(APP_INVITE_TOKEN_PATTERN.source);
        expect(INVITE_TOKEN_PATTERN.flags).toBe(APP_INVITE_TOKEN_PATTERN.flags);
    });

    test.each([
        ['AbCdEfGhIjKlMnOp', true],
        ['a'.repeat(64), true],
        ['Ab_-Ef0123456789', true],
        ['a'.repeat(15), false],
        ['a'.repeat(65), false],
        ['AbCdEfGhIjKlMnO=', false],
        ['AbCdEfGhIjKlMnO/', false],
    ])('USR-082 %s is valid: %s', (token, valid) => {
        expect(INVITE_TOKEN_PATTERN.test(token)).toBe(valid);
    });
});
