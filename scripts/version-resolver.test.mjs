import { expect, test } from 'vitest';

import { resolveAppVersion } from './version-resolver.mjs';

test('returns a task label with the short task head SHA', () => {
    expect(resolveAppVersion({
        baseVersion: '0.9.0',
        branch: 'luna/version-lifecycle',
        taskHeadSha: 'cac582043e053536eefb244511c13f8dcabd6523',
    })).toBe('0.9.0-dev-cac5820');
});

test('returns the base version for a main release build', () => {
    expect(resolveAppVersion({
        baseVersion: '0.9.0',
        branch: 'main',
        taskHeadSha: 'cac582043e053536eefb244511c13f8dcabd6523',
    })).toBe('0.9.0');
});

test('uses the explicit GitHub pull request head SHA before merge or local HEAD', () => {
    expect(resolveAppVersion({
        baseVersion: '0.9.0',
        branch: 'luna/version-lifecycle',
        env: {
            GITHUB_PR_HEAD_SHA: 'cac582043e053536eefb244511c13f8dcabd6523',
            GITHUB_SHA: '1111111111111111111111111111111111111111',
        },
        localHeadSha: '2222222222222222222222222222222222222222',
    })).toBe('0.9.0-dev-cac5820');
});

test('rejects a non-release build without a usable task SHA', () => {
    expect(() => resolveAppVersion({
        baseVersion: '0.9.0',
        branch: 'luna/version-lifecycle',
        readLocalHeadSha: () => '',
    })).toThrow('task HEAD SHA');
});
