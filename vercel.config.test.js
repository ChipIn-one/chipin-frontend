import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

const API_SOURCE = '/api/:path*';
const MANIFEST_SOURCE = '/manifest.webmanifest';
const DEV_MANIFEST_DESTINATION = '/manifest-dev.webmanifest';
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));

const matchesHostCondition = (hostCondition, host) => {
    if (typeof hostCondition.value === 'string') {
        return hostCondition.value === host;
    }

    return (
        hostCondition.value &&
        typeof hostCondition.value === 'object' &&
        typeof hostCondition.value.suf === 'string' &&
        host.endsWith(hostCondition.value.suf)
    );
};

const resolveHostDestination = (source, host) => {
    for (const rewrite of config.rewrites) {
        if (rewrite.source !== source) {
            continue;
        }

        const hostCondition = rewrite.has?.find(condition => condition.type === 'host');

        if (hostCondition && matchesHostCondition(hostCondition, host)) {
            return rewrite.destination;
        }
    }

    return undefined;
};

const apiRewrites = config.rewrites.filter(rewrite => rewrite.source === API_SOURCE);
const resolveApiDestination = host => resolveHostDestination(API_SOURCE, host);
const resolveManifestDestination = host => resolveHostDestination(MANIFEST_SOURCE, host);

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

    test('routes generated Vercel production hostnames to the development API', () => {
        expect(resolveApiDestination('chipin-frontend.vercel.app')).toBe(
            'https://api-dev.chipin.one/:path*',
        );
    });

    test('does not route unsupported custom subdomains to any backend', () => {
        expect(resolveApiDestination('issue-199.dev.chipin.one')).toBeUndefined();
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

describe('Vercel PWA manifest routing', () => {
    test('keeps the production hostname on the production manifest', () => {
        expect(resolveManifestDestination('chipin.one')).toBeUndefined();
    });

    test('routes the development hostname to the DEV manifest', () => {
        expect(resolveManifestDestination('dev.chipin.one')).toBe(
            DEV_MANIFEST_DESTINATION,
        );
    });

    test('routes Vercel preview hostnames to the DEV manifest', () => {
        expect(resolveManifestDestination('chipin-git-feature-123.vercel.app')).toBe(
            DEV_MANIFEST_DESTINATION,
        );
    });

    test('routes generated Vercel production hostnames to the DEV manifest', () => {
        expect(resolveManifestDestination('chipin-frontend.vercel.app')).toBe(
            DEV_MANIFEST_DESTINATION,
        );
    });

    test('does not mark unsupported custom or unknown hosts as development', () => {
        expect(
            resolveManifestDestination('issue-199.dev.chipin.one'),
        ).toBeUndefined();
        expect(resolveManifestDestination('example.com')).toBeUndefined();
    });

    test('keeps manifest host rewrites ahead of the SPA fallback', () => {
        const spaFallbackIndex = config.rewrites.findIndex(
            rewrite => rewrite.source === '/(.*)',
        );
        const lastManifestRewriteIndex = config.rewrites.reduce(
            (lastIndex, rewrite, index) =>
                rewrite.source === MANIFEST_SOURCE ? index : lastIndex,
            -1,
        );

        expect(lastManifestRewriteIndex).toBeGreaterThanOrEqual(0);
        expect(lastManifestRewriteIndex).toBeLessThan(spaFallbackIndex);
    });

    test('serves the DEV manifest as a web manifest', () => {
        const manifestHeadersRule = config.headers.find(
            rule => rule.source === DEV_MANIFEST_DESTINATION,
        );
        const headers = Object.fromEntries(
            manifestHeadersRule.headers.map(header => [header.key, header.value]),
        );

        expect(headers['Content-Type']).toBe('application/manifest+json');
    });
});
