import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { THEME_INIT_SCRIPT, THEME_INIT_SCRIPT_SHA256 } from '@chipin/tokens/theme-init';
import { getTransformedRoutes } from '@vercel/routing-utils';
import { describe, expect, test } from 'vitest';

import { ROOT_FAVICONS } from './integrations/rootFavicons';
import { cspScriptHashes, scriptHash } from './integrations/seoGuard';
import { localizedPath, NON_DEFAULT_LOCALES, SUPPORTED_LOCALES } from './src/i18n/locales';

// Reads the committed, hand-written apps/site/vercel.json and evaluates it with Vercel's own
// route transformer (spec 04 §1.5a, §2.9).
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

/**
 * What the routes do with a request: the first redirect wins, `continue` routes add headers.
 * Vercel substitutes the numbered capture groups (`$1`, ...) into `Location` (an unmatched optional
 * group becomes empty) and appends the request's query string to a destination that has none.
 */
const request = (url: string, host: string): Response => {
    const queryIndex = url.indexOf('?');
    const path = queryIndex === -1 ? url : url.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : url.slice(queryIndex);
    const headers: Record<string, string> = {};

    for (const route of routes) {
        const match = route.src === undefined ? null : new RegExp(route.src).exec(path);

        if (match === null) {
            continue;
        }
        if (!(route.has ?? []).every(condition => conditionMatches(condition, host))) {
            continue;
        }
        if (route.status !== undefined) {
            const template = route.headers?.Location ?? '';
            const location = template.replace(
                /\$(\d+)/g,
                (_, index: string) => match[Number(index)] ?? '',
            );

            return {
                status: route.status,
                location: location.includes('?') ? location : location + query,
                headers,
            };
        }
        Object.assign(headers, route.headers);
    }
    return { status: 200, headers };
};

const PROD = 'chipin.one';
// Vercel attached www.chipin.one with chipin.one in step 2 (04-4b); it serves the site like prod.
const PROD_HOSTS = [PROD, 'www.chipin.one'];
const NOINDEX_HOSTS = ['site-dev.chipin.one', 'dev.chipin.one', 'chipin-site-git-x.vercel.app'];

describe('apps/site/vercel.json', () => {
    test('is valid for Vercel', () => {
        expect(transformed.error).toBeNull();
    });

    // Release model (§1.5): Production Branch `main` never deploys; prod changes only by Promote.
    test('disables Git deployments of the main branch', () => {
        expect(config).toMatchObject({ git: { deploymentEnabled: { main: false } } });
    });

    test.each([...PROD_HOSTS, ...NOINDEX_HOSTS])('sends the security headers on %s', host => {
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

    test.each([...PROD_HOSTS, 'app.chipin.one', 'evil-dev.chipin.one.example'])(
        '%s has no X-Robots-Tag',
        host => {
            expect(request('/', host).headers['X-Robots-Tag']).toBeUndefined();
        },
    );

    // §3.2: one URL form per page.
    test.each(NON_DEFAULT_LOCALES.map(locale => [`/${locale}`, `/${locale}/`]))(
        '%s is a 301 to %s',
        (path, location) => {
            expect(request(path, PROD)).toMatchObject({ status: 301, location });
        },
    );

    test.each(['/', '/ru/', '/sitemap-index.xml', '/robots.txt', '/rus', '/ru/x'])(
        '%s is not redirected',
        path => {
            expect(request(path, PROD).status).toBe(200);
        },
    );
});

// ---- 04-3d, 04-5a: the site redirects (spec 04 §2.9, §3.2, §4.2) ----
// 04-5a (owner decision 2026-11-27): the move redirects of old app URLs and invite links are
// deleted, not switched to 301. What stays normalizes site URLs only.

const SITE_DIR = fileURLToPath(new URL('.', import.meta.url));

interface Redirect {
    source: string;
    destination: string;
    statusCode?: number;
    has?: HostCondition[];
}

const redirects = (config as { redirects?: Redirect[] }).redirects ?? [];

const SITE_HOSTS = ['chipin.one', 'www.chipin.one', 'dev.chipin.one', 'site-dev.chipin.one'];
// The site preview and hosts that never belong to the site.
const OTHER_HOSTS = [
    'chipin-site-git-x.vercel.app',
    'app.chipin.one',
    'app-dev.chipin.one',
    'evil.example',
    'chipin.one.evil.example',
    'www.chipin.one.evil.example',
];
const ALL_HOSTS = [...SITE_HOSTS, ...OTHER_HOSTS];

// Invite tokens are base64url (backend InviteTokenGenerator), as the app's TEST_INVITE_TOKEN.
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';

// The removed public locales (#609): a permanent rule of the site project (§4.2), as in the app.
const isRemovedLocaleRedirect = (redirect: Redirect): boolean =>
    redirect.source.startsWith('/:locale(');

/** Site files a redirect must never shadow: a Vercel redirect fires before a file (§4.1). */
const listFiles = (dir: string): string[] =>
    readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => `/${relative(dir, join(entry.parentPath, entry.name))}`);

// Old app URLs and invite links of the app era: no longer redirected anywhere (04-5a).
const OLD_APP_PATHS = [
    '/dashboard',
    '/dashboard/x',
    '/solo/',
    '/group',
    '/group/1',
    '/friends/1',
    '/settings/a/b',
    '/activity',
    '/login',
    '/oauth/callback?code=x&returnTo=%2Fgroup%2F1',
    `/group/join/${TOKEN}`,
    `/friends/join/${TOKEN}`,
    '/app.html',
];

describe('site redirects (§3.2, §4.2, 04-5a)', () => {
    test.each(ALL_HOSTS)('on %s redirects no old app URL', host => {
        for (const path of OLD_APP_PATHS) {
            expect([path, request(path, host).status]).toEqual([path, 200]);
        }
    });

    test('no redirect is host-scoped', () => {
        expect(redirects.filter(redirect => redirect.has !== undefined)).toEqual([]);
    });

    test('every redirect stays on the site', () => {
        for (const redirect of redirects) {
            expect(redirect.destination).toMatch(/^\/(?![/\\])/);
        }
    });

    test.each([
        ['/sitemap.xml', '/sitemap-index.xml'],
        ['/index.html', '/'],
        ['/privacy/index.html', '/privacy'],
        ['/es', '/'],
        ['/es/privacy', '/privacy'],
        ['/pt-br/', '/'],
        ['/pt-PT/terms/', '/terms'],
    ])('on every host %s redirects to %s', (path, location) => {
        for (const host of ALL_HOSTS) {
            expect(request(path, host).location).toBe(location);
        }
    });

    // Only the removed locales (#609) and the trailing-slash rows (§3.2) are permanent.
    test('the only 302 rows are /sitemap.xml, /index.html and /<page>/index.html', () => {
        const permanent = redirects.filter(redirect => redirect.statusCode !== 302);

        expect(
            redirects.filter(redirect => redirect.statusCode === 302).map(({ source }) => source),
        ).toEqual(['/sitemap.xml', '/index.html', '/:path([^/\\\\].*?)/index.html']);
        for (const redirect of permanent) {
            expect(redirect.statusCode).toBe(301);
        }
        expect(permanent.filter(isRemovedLocaleRedirect)).toHaveLength(1);
    });

    // §3.2: `/<locale>` → `/<locale>/` for locale homes and `/<page>/` → `/<page>` for other pages.
    test('the trailing-slash 301 rows are LOCALE_PATH × pages', () => {
        const pageFiles = readdirSync(join(SITE_DIR, 'src/pages')).filter(
            file => file.endsWith('.astro') && file !== '404.astro',
        );
        const slugs = pageFiles.map(file => file.replace(/\.astro$/, '').replace(/^index$/, ''));
        const expected = SUPPORTED_LOCALES.flatMap(locale =>
            slugs.flatMap(slug => {
                const path = localizedPath(locale, slug);

                if (path === '/') {
                    return [];
                }
                return slug === ''
                    ? [{ source: path.slice(0, -1), destination: path }]
                    : [{ source: `${path}/`, destination: path }];
            }),
        );
        const trailingSlashRows = redirects
            .filter(redirect => redirect.statusCode === 301 && !isRemovedLocaleRedirect(redirect))
            .map(({ source, destination }) => ({ source, destination }));

        expect(slugs).toContain('');
        expect(trailingSlashRows).toEqual(expected);
    });
});

describe('paths the site never redirects (§4.2)', () => {
    const NEVER_REDIRECTED = [
        '/',
        '/privacy',
        '/terms',
        '/ru/',
        '/ru/privacy',
        '/ru/terms',
        '/api/stats',
        '/.well-known/assetlinks.json',
        '/_astro/index.Ab12Cd34.css',
        '/_astro/hoisted.Ab12Cd34.js',
        '/_astro/favicon.Ab12Cd34.svg',
        '/_vercel/insights/script.js',
        '/_vercel/speed-insights/script.js',
        '/favicon.svg',
        '/favicon.ico',
        '/robots.txt',
        '/llms.txt',
        '/not-found',
        '/manifest.webmanifest',
        '/pwa-192x192.png',
        '/pwa-512x512.png',
        '/sitemap-index.xml',
        `/join/group/${TOKEN}`,
        `/join/friend/${TOKEN}`,
    ];

    test.each(ALL_HOSTS)('on %s none of them is redirected', host => {
        for (const path of NEVER_REDIRECTED) {
            expect([path, request(path, host).status]).toEqual([path, 200]);
        }
    });

    // A Vercel redirect fires before a file (§4.1; C1-19, C3-11): no source may shadow a site
    // file. HTML entries are excluded: `/<page>/index.html` is intended (A-33).
    test.each(ALL_HOSTS)('on %s no redirect shadows a public or emitted file', host => {
        const dist = join(SITE_DIR, 'dist');
        const built = existsSync(join(dist, 'index.html'));
        // CI builds the site before its tests (frontend-ci.yml), so a missing dist there is a bug.
        expect(built || process.env.CI !== 'true').toBe(true);
        const files = [
            ...listFiles(join(SITE_DIR, 'public')),
            ...(built ? listFiles(dist) : []),
        ].filter(file => !file.endsWith('.html'));

        expect(files).toContain('/.well-known/assetlinks.json');
        if (built) {
            // Emitted by integrations/rootFavicons.ts (issue 859).
            expect(files).toContain('/favicon.svg');
            expect(files).toContain('/favicon.ico');
            for (const { file, source } of ROOT_FAVICONS) {
                expect(readFileSync(join(dist, file)).equals(readFileSync(source))).toBe(true);
            }
        }
        for (const file of files) {
            expect([file, request(file, host).status]).toEqual([file, 200]);
        }
    });

    // Without a build: the root favicons rootFavicons emits are served, not redirected (issue 859).
    test.each(ALL_HOSTS)('on %s no redirect matches the root favicons', host => {
        for (const { file } of ROOT_FAVICONS) {
            expect([file, request(`/${file}`, host).status]).toEqual([file, 200]);
        }
    });

    // The rows only normalize site URLs (§3.2, A-33, #609).
    test('the redirect rows are the same-site ones', () => {
        expect(redirects.map(({ source }) => source)).toEqual([
            '/sitemap.xml',
            '/index.html',
            '/:path([^/\\\\].*?)/index.html',
            '/:locale(es|pt-br|pt-pt|pt-BR|pt-PT){/:path([^/\\\\].*?)}?{/}?',
            // The trailing-slash 301 rows, pinned by "the trailing-slash 301 rows are LOCALE_PATH × pages".
            ...redirects
                .filter(
                    redirect => redirect.statusCode === 301 && !isRemovedLocaleRedirect(redirect),
                )
                .map(({ source }) => source),
        ]);
    });
});

describe('no open redirect', () => {
    const CRAFTED = [
        '/dashboard//evil.example',
        '/dashboard/@evil.example',
        '/oauth/callback?returnTo=https://evil.example',
        '/group/join/%2F%2Fevil.example',
        '/friends/join/%5C%5Cevil.example',
        '//evil.example/index.html',
        '/%2F%2Fevil.example/index.html',
        '/es//evil.example',
        '/es/%2F%2Fevil.example',
        '/ru?x=//evil.example',
        '/es/%5Cevil.example',
        '/es/\\evil.example',
        '/%5Cevil.example/index.html',
        '/\\evil.example/index.html',
    ];

    test.each(ALL_HOSTS)('on %s every Location is a same-site path', host => {
        for (const url of CRAFTED) {
            const { status, location } = request(url, host);

            if (status === 200) {
                continue;
            }
            const sameSite = location !== undefined && /^\/(?![/\\])/.test(location);

            expect([url, sameSite]).toEqual([url, true]);
        }
    });
});

describe('assetlinks (§4.6)', () => {
    test('the site assetlinks.json is byte-identical to the app one', () => {
        const site = readFileSync(join(SITE_DIR, 'public/.well-known/assetlinks.json'));
        const app = readFileSync(join(SITE_DIR, '../app/public/.well-known/assetlinks.json'));

        expect(site.equals(app)).toBe(true);
    });
});

// ---- 04-3c: the invite landing (spec 04 §3.5, §4.3; KB USR-080, USR-085) ----

describe('invite landing (§3.5)', () => {
    /** Where the rewrites send a path that no file and no redirect serves. */
    const rewrite = (path: string): string | undefined => {
        const afterFilesystem = routes.slice(routes.findIndex(route => 'handle' in route) + 1);

        for (const route of afterFilesystem as (EvaluatedRoute & { dest?: string })[]) {
            const match = route.src === undefined ? null : new RegExp(route.src).exec(path);

            if (match !== null && route.dest !== undefined) {
                return route.dest.replace(
                    /\$(\d+)/g,
                    (_, index: string) => match[Number(index)] ?? '',
                );
            }
        }
        return undefined;
    };

    test.each([
        [`/join/group/${TOKEN}`, '/join/group'],
        [`/join/group/${TOKEN}/`, '/join/group'],
        [`/join/friend/${TOKEN}`, '/join/friend'],
        ['/join/group/short', '/join/group'],
    ])('USR-080 rewrites %s to the page %s', (path, page) => {
        expect(rewrite(path)).toBe(page);
    });

    test.each(['/join/other/x', '/join/group', '/join/group/a/b', '/x/join/group/a'])(
        'USR-080 does not rewrite %s',
        path => {
            expect(rewrite(path)).toBeUndefined();
        },
    );

    test('USR-080 every rewrite but the statistics proxy is the invite landing', () => {
        const rewrites = (config as { rewrites?: { source?: unknown }[] }).rewrites ?? [];

        expect(rewrites.filter(row => row.source !== '/api/stats')).toEqual([
            { source: '/join/:kind(group|friend)/:token{/}?', destination: '/join/:kind' },
        ]);
    });

    test.each(ALL_HOSTS)('USR-085 on %s the landing sends no referrer', host => {
        for (const path of [`/join/group/${TOKEN}`, `/join/friend/${TOKEN}`, '/join/group']) {
            expect(request(path, host)).toMatchObject({
                status: 200,
                headers: { 'Referrer-Policy': 'no-referrer' },
            });
        }
        expect(request('/', host).headers['Referrer-Policy']).toBe(
            'strict-origin-when-cross-origin',
        );
        expect(request('/joiner', host).headers['Referrer-Policy']).toBe(
            'strict-origin-when-cross-origin',
        );
    });

    test.each([`/join/group/${TOKEN}`, '/join/group'])(
        'USR-085 %s keeps the site CSP and the other security headers',
        path => {
            const { headers } = request(path, PROD);

            expect(headers['Content-Security-Policy']).toBe(
                request('/', PROD).headers['Content-Security-Policy'],
            );
            expect(headers['X-Frame-Options']).toBe('DENY');
            expect(headers['X-Content-Type-Options']).toBe('nosniff');
        },
    );

    test('USR-085 robots.txt disallows /join/ and /api/', () => {
        const robots = readFileSync(join(SITE_DIR, 'public/robots.txt'), 'utf8');
        const disallowed = [...robots.matchAll(/^Disallow:\s*(\S+)\s*$/gm)].map(match => match[1]);

        expect(disallowed).toEqual(expect.arrayContaining(['/join/', '/api/']));
        expect(robots).toMatch(/^User-agent: \*$/m);
    });
});

// ---- 04-3b1: the home page (spec 04 §3.6, §4.1) ----

describe('theme-init on every page (§3.6, 05-3)', () => {
    test('the CSP allows the inline theme-init script by its hash', () => {
        const hash = scriptHash(THEME_INIT_SCRIPT);

        expect(hash).toBe(`'${THEME_INIT_SCRIPT_SHA256}'`);
        expect(cspScriptHashes(config)).toContain(hash);
    });
});

describe('/api/stats, the landing statistics proxy (§4.1)', () => {
    /** Where the rewrites send `path` on `host`: the first matching rewrite after the files. */
    const rewriteOn = (path: string, host: string): string | undefined => {
        const afterFilesystem = routes.slice(routes.findIndex(route => 'handle' in route) + 1);

        for (const route of afterFilesystem as (EvaluatedRoute & { dest?: string })[]) {
            const match = route.src === undefined ? null : new RegExp(route.src).exec(path);

            if (
                match !== null &&
                route.dest !== undefined &&
                (route.has ?? []).every(condition => conditionMatches(condition, host))
            ) {
                return route.dest;
            }
        }
        return undefined;
    };

    /** The backend of each host's environment, as the app project's `/api` proxy. */
    const STATS_BACKENDS: Record<string, string> = {
        'chipin.one': 'https://api.chipin.one/stats',
        'www.chipin.one': 'https://api.chipin.one/stats',
        'dev.chipin.one': 'https://api-dev.chipin.one/stats',
        'site-dev.chipin.one': 'https://api-dev.chipin.one/stats',
        'chipin-site-git-x.vercel.app': 'https://api-dev.chipin.one/stats',
    };

    test.each(Object.entries(STATS_BACKENDS))('on %s proxies to %s', (host, backend) => {
        expect(request('/api/stats', host).status).toBe(200);
        expect(rewriteOn('/api/stats', host)).toBe(backend);
    });

    test.each([
        'app.chipin.one',
        'evil.example',
        'chipin.one.evil.example',
        'www.chipin.one.evil.example',
    ])('on %s proxies nothing', host => {
        expect(rewriteOn('/api/stats', host)).toBeUndefined();
    });

    test('only /api/stats reaches the backend: no other API path, no prefix match', () => {
        for (const host of Object.keys(STATS_BACKENDS)) {
            for (const path of ['/api/stats/x', '/api/statsx', '/api/users/me', '/api', '/stats']) {
                expect([host, path, rewriteOn(path, host)]).toEqual([host, path, undefined]);
            }
        }
    });

    test.each(ALL_HOSTS)('on %s the response is never cached', host => {
        expect(request('/api/stats', host).headers).toMatchObject({
            'Cache-Control': 'private, no-store',
            'X-Vercel-Enable-Rewrite-Caching': '0',
        });
        expect(request('/', host).headers['X-Vercel-Enable-Rewrite-Caching']).toBeUndefined();
    });

    // A file wins over a rewrite (§4.1): nothing in public/ may serve /api/*.
    test('no site file shadows the proxy', () => {
        expect(existsSync(join(SITE_DIR, 'public/api'))).toBe(false);
        expect(existsSync(join(SITE_DIR, 'src/pages/api'))).toBe(false);
    });

    test('the CSP keeps connect-src to the same origin', () => {
        expect(request('/', PROD).headers['Content-Security-Policy']).toMatch(
            /(?:^|; )connect-src 'self'(?:;|$)/,
        );
    });
});
