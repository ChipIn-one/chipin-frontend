import { readFileSync } from 'node:fs';

import { getTransformedRoutes } from '@vercel/routing-utils';
import { describe, expect, test } from 'vitest';

import { cspScriptHashes } from './integrations/seoGuard';

// Reads the committed, hand-written apps/site/vercel.json and evaluates it with Vercel's own
// route transformer (spec 04 §1.5a, §2.9). 04-3d extends this file with the §4.2 redirects.
const config: unknown = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const transformed = getTransformedRoutes(config as Parameters<typeof getTransformedRoutes>[0]);

/** The fields of a transformed route this test evaluates. */
interface EvaluatedRoute {
    src?: string;
    has?: unknown[];
    headers?: Record<string, string>;
    status?: number;
}

// The package's `Route` union references types it does not ship (they resolve to error types);
// the transformer output is plain JSON with the fields above.
const routes = (transformed.routes ?? []) as unknown as EvaluatedRoute[];

type HostCondition = { type: 'host'; value: { eq?: string; suf?: string } };

const conditionMatches = (condition: unknown, host: string): boolean => {
    const { type, value } = condition as Partial<HostCondition>;

    if (type !== 'host' || typeof value !== 'object') {
        // Only host conditions are used; any other one would need its own evaluation here.
        throw new Error(`unexpected condition ${JSON.stringify(condition)}`);
    }
    if (typeof value.eq === 'string') {
        return value.eq === host;
    }
    return typeof value.suf === 'string' && host.endsWith(value.suf);
};

interface Response {
    status: number;
    location?: string;
    headers: Record<string, string>;
}

/** What the routes do with a request: the first redirect wins, `continue` routes add headers. */
const request = (path: string, host: string): Response => {
    const headers: Record<string, string> = {};

    for (const route of routes) {
        if (route.src === undefined || !new RegExp(route.src).test(path)) {
            continue;
        }
        if (!(route.has ?? []).every(condition => conditionMatches(condition, host))) {
            continue;
        }
        if (route.status !== undefined) {
            return { status: route.status, location: route.headers?.Location, headers };
        }
        Object.assign(headers, route.headers);
    }
    return { status: 200, headers };
};

const PROD = 'chipin.one';
const NOINDEX_HOSTS = ['site-dev.chipin.one', 'dev.chipin.one', 'chipin-site-git-x.vercel.app'];

describe('apps/site/vercel.json', () => {
    test('is valid for Vercel', () => {
        expect(transformed.error).toBeNull();
    });

    // Release model (§1.5): Production Branch `main` never deploys; prod changes only by Promote.
    test('disables Git deployments of the main branch', () => {
        expect(config).toMatchObject({ git: { deploymentEnabled: { main: false } } });
    });

    test.each([PROD, ...NOINDEX_HOSTS])('sends the security headers on %s', host => {
        for (const path of ['/', '/ru/', '/missing']) {
            const { headers } = request(path, host);

            expect(headers['Content-Security-Policy']).toBeDefined();
            expect(headers['X-Frame-Options']).toBe('DENY');
            expect(headers['X-Content-Type-Options']).toBe('nosniff');
            expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
        }
    });

    // §3.6, A-02: base directives of the app CSP, no inline code except hashed scripts.
    test('the CSP allows only same-origin code', () => {
        const csp = request('/', PROD).headers['Content-Security-Policy'] ?? '';
        const directives = new Map(
            csp.split(';').map(part => {
                const [name = '', ...sources] = part.trim().split(/\s+/);

                return [name, sources] as const;
            }),
        );

        expect(directives.get('object-src')).toEqual(["'none'"]);
        expect(directives.get('base-uri')).toEqual(["'self'"]);
        expect(directives.get('form-action')).toEqual(["'self'"]);
        expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
        expect(directives.get('connect-src')).toEqual(["'self'"]);
        expect(directives.get('style-src')).toEqual(["'self'"]);
        expect(directives.get('script-src')).toEqual(["'self'", ...cspScriptHashes(config).sort()]);
        expect(csp).not.toMatch(/unsafe-|https?:|\*/);
    });

    // §4.3: dev and preview hosts are noindex, chipin.one is not.
    test.each(NOINDEX_HOSTS)('%s is noindex', host => {
        expect(request('/', host).headers['X-Robots-Tag']).toBe('noindex, nofollow');
        expect(request('/ru/', host).headers['X-Robots-Tag']).toBe('noindex, nofollow');
    });

    test.each([PROD, 'www.chipin.one', 'app.chipin.one', 'evil-dev.chipin.one.example'])(
        '%s has no X-Robots-Tag',
        host => {
            expect(request('/', host).headers['X-Robots-Tag']).toBeUndefined();
        },
    );

    // §3.2: one URL form per page; the sitemap has one name.
    test.each([
        ['/ru', '/ru/'],
        ['/sitemap.xml', '/sitemap-index.xml'],
    ])('%s is a 301 to %s', (path, location) => {
        expect(request(path, PROD)).toMatchObject({ status: 301, location });
    });

    test.each(['/', '/ru/', '/sitemap-index.xml', '/robots.txt', '/rus', '/ru/x'])(
        '%s is not redirected',
        path => {
            expect(request(path, PROD).status).toBe(200);
        },
    );
});
