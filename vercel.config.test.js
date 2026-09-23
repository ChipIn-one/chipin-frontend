import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

const API_SOURCE = '/api/:path*';
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));

const apiRewrites = config.rewrites.filter(rewrite => rewrite.source === API_SOURCE);

const resolveApiDestination = host => {
    for (const rewrite of apiRewrites) {
        const hostCondition = rewrite.has?.find(condition => condition.type === 'host');

        if (!hostCondition) {
            continue;
        }

        if (typeof hostCondition.value === 'string' && hostCondition.value === host) {
            return rewrite.destination;
        }

        if (
            hostCondition.value &&
            typeof hostCondition.value === 'object' &&
            typeof hostCondition.value.suf === 'string' &&
            host.endsWith(hostCondition.value.suf)
        ) {
            return rewrite.destination;
        }
    }

    return undefined;
};

describe('Vercel API proxy routing', () => {
    test('routes the production hostname only to the production API', () => {
        expect(resolveApiDestination('chipin.one')).toBe(
            'https://api.chipin.one/:path*',
        );
    });

    test('routes the development hostname to the development API', () => {
        expect(resolveApiDestination('dev.chipin.one')).toBe(
            'https://api-dev.chipin.one/:path*',
        );
    });

    test('routes Vercel preview hostnames to the development API', () => {
        expect(resolveApiDestination('chipin-git-feature-123.vercel.app')).toBe(
            'https://api-dev.chipin.one/:path*',
        );
    });

    test('does not route an unknown hostname to any backend', () => {
        expect(resolveApiDestination('example.com')).toBeUndefined();
        expect(apiRewrites.every(rewrite => rewrite.has?.length > 0)).toBe(true);
    });

    test('keeps API rewrites ahead of the SPA fallback', () => {
        const spaFallbackIndex = config.rewrites.findIndex(
            rewrite => rewrite.source === '/(.*)',
        );
        const lastApiRewriteIndex = config.rewrites.reduce(
            (lastIndex, rewrite, index) =>
                rewrite.source === API_SOURCE ? index : lastIndex,
            -1,
        );

        expect(lastApiRewriteIndex).toBeGreaterThanOrEqual(0);
        expect(lastApiRewriteIndex).toBeLessThan(spaFallbackIndex);
    });

    test('disables browser and CDN caching for proxied API responses', () => {
        const apiHeadersRule = config.headers.find(rule => rule.source === API_SOURCE);
        const headers = Object.fromEntries(
            apiHeadersRule.headers.map(header => [header.key, header.value]),
        );

        expect(headers['Cache-Control']).toBe('private, no-store, max-age=0');
        expect(headers['CDN-Cache-Control']).toBe('no-store');
        expect(headers['Vercel-CDN-Cache-Control']).toBe('no-store');
        expect(headers['X-Vercel-Enable-Rewrite-Caching']).toBe('0');
    });
});
