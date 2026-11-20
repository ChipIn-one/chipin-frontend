import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { describe, expect, test } from 'vitest';

import { cspScriptHashes, scriptHash } from '../../integrations/seoGuard';

import { ANALYTICS_REDACT_SCRIPT, redactInviteUrl } from './analyticsRedact';

type BeforeSend = (event: unknown) => unknown;

/** Runs the inline script against a fake `window`; returns the queued `beforeSend` of va and si. */
const loadScript = () => {
    const window: Record<string, unknown> = {};

    runInNewContext(ANALYTICS_REDACT_SCRIPT, { window, Object });
    const queued = (name: 'vaq' | 'siq'): BeforeSend => {
        const queue = window[name] as ArrayLike<unknown>[];
        const call = queue.map(args => Array.from(args)).find(([kind]) => kind === 'beforeSend');

        return call?.[1] as BeforeSend;
    };

    return { va: queued('vaq'), si: queued('siq') };
};

// Spec 04 §3.6 (review B M13), KB USR-084.
describe('analytics token redaction', () => {
    test.each([
        ['/join/group/abc?x=1', '/join/group/[token]?x=1'],
        [
            'https://chipin.one/join/friend/AbC_-123#top',
            'https://chipin.one/join/friend/[token]#top',
        ],
        ['https://chipin.one/join/group/abc/extra', 'https://chipin.one/join/group/[token]/extra'],
        ['https://chipin.one/privacy?x=1', 'https://chipin.one/privacy?x=1'],
        ['https://chipin.one/join/other/abc', 'https://chipin.one/join/other/abc'],
        ['/JOIN/Group/abc?x=1', '/JOIN/Group/[token]?x=1'],
        ['/friends/join/abc/', '/friends/join/[token]/'],
        ['/group/join/abc?r=/join/friend/def', '/group/join/[token]?r=/join/friend/[token]'],
        ['/groups/join/abc', '/groups/join/abc'],
    ])('USR-084 %s is reported as %s', (url, expected) => {
        expect(redactInviteUrl(url)).toBe(expected);
    });

    test.each(['va', 'si'] as const)('USR-084 the inline script redacts the token for %s', name => {
        const beforeSend = loadScript()[name];
        const event = { type: 'pageview', url: '/join/group/abc?x=1' };

        expect(beforeSend(event)).toEqual({ type: 'pageview', url: '/join/group/[token]?x=1' });
        expect(event.url).toBe('/join/group/abc?x=1');
        expect(beforeSend({ type: 'event' })).toEqual({ type: 'event' });
    });

    test('USR-084 the inline script keeps an existing va and si queue function', () => {
        const calls: unknown[][] = [];
        const record = (...args: unknown[]) => calls.push(args);

        runInNewContext(ANALYTICS_REDACT_SCRIPT, { window: { va: record, si: record }, Object });
        expect(calls.map(([kind]) => kind)).toEqual(['beforeSend', 'beforeSend']);
    });

    test('USR-084 the inline script matches redactInviteUrl', () => {
        const { va } = loadScript();

        for (const url of [
            '/join/friend/x?y#z',
            '/join/group/a/b',
            '/x/join/group/a',
            '/Join/FRIEND/a/join/group/b',
            '/group/join/a',
        ]) {
            expect(va({ url })).toEqual({ url: redactInviteUrl(url) });
        }
    });

    test('USR-084 the hash of the inline script is in the vercel.json CSP', () => {
        const config: unknown = JSON.parse(
            readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
        );

        expect(cspScriptHashes(config)).toContain(scriptHash(ANALYTICS_REDACT_SCRIPT));
    });
});
