import { beforeEach, expect, test } from 'vitest';

import { LS_KEY_AUTH_SESSION_HINT } from 'constants/localstorage';
import { LocalStorage } from 'helpers/localStorage';

import { persistedUserId } from './persistedUserId';

beforeEach(() => {
    LocalStorage.remove(LS_KEY_AUTH_SESSION_HINT);
});

test('a cached id with a session hint: that user', () => {
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);

    expect(persistedUserId('user-1')).toBe('user-1');
});

test.each([
    ['no hint', undefined],
    ['hint false (expired / signed out)', false],
])(
    'a cached id without a session hint (%s): no persisted user (spec 03 §1.5 "missing", C3-09)',
    (_name, hint) => {
        if (hint !== undefined) {
            LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, hint);
        }

        expect(persistedUserId('user-1')).toBeUndefined();
    },
);

test('no cached id: no persisted user', () => {
    LocalStorage.set(LS_KEY_AUTH_SESSION_HINT, true);

    expect(persistedUserId(undefined)).toBeUndefined();
});
