import { describe, expect, test, vi } from 'vitest';

import {
    parseRemoteTagRefs,
    resolveAppVersion,
    resolveAppVersionInfo,
} from './version-resolver.mjs';

const SHA = 'cac582043e053536eefb244511c13f8dcabd6523';
const OTHER_SHA = '1111111111111111111111111111111111111111';
const TAG_OBJECT_SHA = '9999999999999999999999999999999999999999';

const vercelEnv = (overrides = {}) => ({
    VERCEL: '1',
    VERCEL_ENV: 'production',
    VERCEL_GIT_COMMIT_SHA: SHA,
    VERCEL_GIT_REPO_OWNER: 'ChipIn-one',
    VERCEL_GIT_REPO_SLUG: 'chipin-frontend',
    ...overrides,
});

const remoteRefs = lines => () => lines.join('\n');

const failLocal = () => {
    throw new Error('local git must not be used on Vercel');
};

const failRemote = () => {
    throw new Error('ls-remote must not be used outside Vercel');
};

describe('Vercel builds (git ls-remote)', () => {
    test('a lightweight tag on the commit makes a release', () => {
        expect(
            resolveAppVersionInfo({
                env: vercelEnv(),
                readLocalTags: failLocal,
                readRemoteTagRefs: remoteRefs([
                    `${OTHER_SHA}\trefs/tags/v1.1.0`,
                    `${SHA}\trefs/tags/v1.2.0`,
                ]),
            }),
        ).toEqual({ version: '1.2.0', isRelease: true, tag: 'v1.2.0' });
    });

    test('an annotated tag matches through its peeled commit', () => {
        expect(
            resolveAppVersionInfo({
                env: vercelEnv(),
                readLocalTags: failLocal,
                readRemoteTagRefs: remoteRefs([
                    `${TAG_OBJECT_SHA}\trefs/tags/v2.0.0`,
                    `${SHA}\trefs/tags/v2.0.0^{}`,
                ]),
            }),
        ).toEqual({ version: '2.0.0', isRelease: true, tag: 'v2.0.0' });
    });

    test('an annotated tag object SHA alone is not the commit', () => {
        expect(
            resolveAppVersionInfo({
                env: vercelEnv({ VERCEL_GIT_COMMIT_SHA: TAG_OBJECT_SHA }),
                readRemoteTagRefs: remoteRefs([
                    `${TAG_OBJECT_SHA}\trefs/tags/v2.0.0`,
                    `${SHA}\trefs/tags/v2.0.0^{}`,
                ]),
            }),
        ).toEqual({ version: '2.0.0-dev-9999999', isRelease: false, tag: null });
    });

    test('several tags on the commit pick the highest', () => {
        expect(
            resolveAppVersionInfo({
                env: vercelEnv(),
                readRemoteTagRefs: remoteRefs([
                    `${SHA}\trefs/tags/v1.9.0`,
                    `${SHA}\trefs/tags/v1.10.0`,
                    `${SHA}\trefs/tags/v1.2.3`,
                ]),
            }),
        ).toEqual({ version: '1.10.0', isRelease: true, tag: 'v1.10.0' });
    });

    test('an untagged commit uses the highest prior tag and the short SHA', () => {
        expect(
            resolveAppVersionInfo({
                env: vercelEnv(),
                readRemoteTagRefs: remoteRefs([
                    `${OTHER_SHA}\trefs/tags/v1.10.0`,
                    `${OTHER_SHA}\trefs/tags/v1.9.9`,
                ]),
            }),
        ).toEqual({ version: '1.10.0-dev-cac5820', isRelease: false, tag: null });
    });

    test('no tags at all falls back to 0.0.0', () => {
        expect(
            resolveAppVersionInfo({ env: vercelEnv(), readRemoteTagRefs: remoteRefs([]) }),
        ).toEqual({ version: '0.0.0-dev-cac5820', isRelease: false, tag: null });
    });

    test('invalid tags are ignored', () => {
        expect(
            resolveAppVersionInfo({
                env: vercelEnv(),
                readRemoteTagRefs: remoteRefs([
                    `${SHA}\trefs/tags/v01.2.3`,
                    `${SHA}\trefs/tags/v1.2`,
                    `${SHA}\trefs/tags/1.2.3`,
                    `${SHA}\trefs/tags/v1.2.3-rc.1`,
                    `${OTHER_SHA}\trefs/tags/v0.4.0`,
                ]),
            }),
        ).toEqual({ version: '0.4.0-dev-cac5820', isRelease: false, tag: null });
    });

    test('an ls-remote failure warns once and never labels a release', () => {
        const warn = vi.fn();

        expect(
            resolveAppVersionInfo({
                env: vercelEnv(),
                readLocalTags: failLocal,
                readRemoteTagRefs: () => {
                    throw new Error('spawnSync git ETIMEDOUT');
                },
                warn,
            }),
        ).toEqual({ version: '0.0.0-dev-cac5820', isRelease: false, tag: null });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('ETIMEDOUT');
        expect(warn.mock.calls[0][0]).toContain('not a release');
    });

    test('queries the repository named by the Vercel env, with a safe fallback', () => {
        const readRemoteTagRefs = vi.fn(() => '');

        resolveAppVersionInfo({
            env: vercelEnv({ VERCEL_GIT_REPO_OWNER: 'fork-owner', VERCEL_GIT_REPO_SLUG: 'fe' }),
            readRemoteTagRefs,
        });
        resolveAppVersionInfo({
            env: vercelEnv({ VERCEL_GIT_REPO_OWNER: '', VERCEL_GIT_REPO_SLUG: 'a/b' }),
            readRemoteTagRefs,
        });

        expect(readRemoteTagRefs.mock.calls).toEqual([
            ['https://github.com/fork-owner/fe.git'],
            ['https://github.com/ChipIn-one/chipin-frontend.git'],
        ]);
    });
});

describe('non-Vercel builds (local git)', () => {
    test('a local tag on HEAD makes a release without touching the network', () => {
        const readLocalTags = vi.fn(() => ({
            pointsAt: ['v1.3.0', 'not-a-release'],
            all: ['v1.2.0', 'v1.3.0'],
        }));

        expect(
            resolveAppVersionInfo({
                env: {},
                readLocalHeadSha: () => SHA,
                readLocalTags,
                readRemoteTagRefs: failRemote,
            }),
        ).toEqual({ version: '1.3.0', isRelease: true, tag: 'v1.3.0' });
        expect(readLocalTags).toHaveBeenCalledWith(SHA);
    });

    test('an untagged local commit uses the highest local tag', () => {
        expect(
            resolveAppVersion({
                env: {},
                readLocalHeadSha: () => SHA,
                readLocalTags: () => ({ pointsAt: [], all: ['v1.2.0', 'v1.11.0', 'v1.2'] }),
                readRemoteTagRefs: failRemote,
            }),
        ).toBe('1.11.0-dev-cac5820');
    });

    test('uses the explicit GitHub pull request head SHA before merge or local HEAD', () => {
        expect(
            resolveAppVersion({
                env: { GITHUB_PR_HEAD_SHA: SHA, GITHUB_SHA: OTHER_SHA },
                localHeadSha: '2222222222222222222222222222222222222222',
                readLocalTags: () => ({ pointsAt: [], all: [] }),
            }),
        ).toBe('0.0.0-dev-cac5820');
    });

    test('rejects a build without a usable commit SHA', () => {
        expect(() =>
            resolveAppVersionInfo({
                env: {
                    CHIPIN_TASK_HEAD_SHA: '',
                    GITHUB_PR_HEAD_SHA: '',
                    GITHUB_SHA: '',
                    VERCEL_GIT_COMMIT_SHA: '',
                },
                readLocalHeadSha: () => '',
            }),
        ).toThrow('HEAD SHA');
    });
});

test('parseRemoteTagRefs prefers the peeled commit regardless of line order', () => {
    const refs = parseRemoteTagRefs(
        [
            `${SHA}\trefs/tags/v1.0.0^{}`,
            `${TAG_OBJECT_SHA}\trefs/tags/v1.0.0`,
            `${OTHER_SHA}\trefs/heads/master`,
        ].join('\n'),
    );

    expect([...refs]).toEqual([['v1.0.0', SHA]]);
});
