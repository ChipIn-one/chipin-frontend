import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getTransformedRoutes } from '@vercel/routing-utils';
import { describe, expect, test } from 'vitest';

import { PRIVATE_SPA_NAVIGATION_ALLOWLIST } from './scripts/private-spa-navigation.ts';
import { LEGACY_HOST_APP_ORIGINS } from './src/helpers/legacyHost.ts';
import { LEGACY_SERVICE_WORKER_HOSTNAMES } from './src/helpers/serviceWorkerHost.ts';

const API_SOURCE = '/api/:path*';
const config = JSON.parse(readFileSync(resolve(import.meta.dirname, 'vercel.json'), 'utf8'));
const DIST = resolve(import.meta.dirname, 'dist');

const apiRewrites = config.rewrites.filter(rewrite => rewrite.source === API_SOURCE);

// A host condition is `{ eq: host }` (exact match) or `{ suf: '.vercel.app' }` (previews). A plain
// string value is a regex-like string that Vercel does not document as anchored, so the config must
// not use one for a host (L1 of the 04-4a2 review): `chipin.one` must never match `app.chipin.one`.
const hostConditionMatches = (condition, host) => {
    if (condition.type !== 'host' || !condition.value || typeof condition.value !== 'object') {
        return false;
    }

    if (typeof condition.value.eq === 'string') {
        return condition.value.eq === host;
    }

    return typeof condition.value.suf === 'string' && host.endsWith(condition.value.suf);
};

// The exact host of an `{ eq }` condition (for the tests that list the hosts of a rule).
const exactHost = condition => condition.value?.eq;

const resolveApiDestination = host => {
    for (const rewrite of apiRewrites) {
        const hostCondition = rewrite.has?.find(condition => condition.type === 'host');

        if (!hostCondition) {
            continue;
        }

        if (hostConditionMatches(hostCondition, host)) {
            return rewrite.destination;
        }
    }

    return undefined;
};

describe('Vercel API proxy routing', () => {
    test('routes the production hostname only to the production API', () => {
        expect(resolveApiDestination('chipin.one')).toBe('https://api.chipin.one/:path*');
    });

    test('routes the development hostname to the development API', () => {
        expect(resolveApiDestination('dev.chipin.one')).toBe('https://api-dev.chipin.one/:path*');
    });

    // 04-4a2 (spec 04 §2.9): the app on its new host needs its backend.
    test('routes the production app host only to the production API', () => {
        expect(resolveApiDestination('app.chipin.one')).toBe('https://api.chipin.one/:path*');
    });

    test('routes the development app host to the development API', () => {
        expect(resolveApiDestination('app-dev.chipin.one')).toBe(
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

    test('keeps API rewrites before private SPA routes without capturing public SSG HTML', () => {
        const lastApiRewriteIndex = config.rewrites.reduce(
            (lastIndex, rewrite, index) => (rewrite.source === API_SOURCE ? index : lastIndex),
            -1,
        );
        const appRewrites = config.rewrites
            .map((rewrite, index) => ({ ...rewrite, index }))
            .filter(rewrite => rewrite.destination === '/app.html');

        expect(lastApiRewriteIndex).toBeGreaterThanOrEqual(0);
        expect(appRewrites.length).toBeGreaterThan(0);
        expect(appRewrites.every(rewrite => rewrite.index > lastApiRewriteIndex)).toBe(true);
        expect(appRewrites.every(rewrite => rewrite.source !== '/(.*)')).toBe(true);
        expect(appRewrites.map(rewrite => rewrite.source)).toEqual(
            expect.arrayContaining([
                '/dashboard/:path*',
                '/group/:path*',
                '/friends/:path*',
                '/oauth/:path*',
            ]),
        );
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

    test('disables automatic Vercel Git deployments only for dev and main', () => {
        expect(config.git?.deploymentEnabled).toEqual({ dev: false, main: false });
    });
});

describe('Vercel production security headers', () => {
    test('keeps script-src free of unsafe-inline while preserving connect-src', () => {
        const appHeadersRule = config.headers.find(rule => rule.source === '/(.*)');
        const headers = Object.fromEntries(
            appHeadersRule.headers.map(header => [header.key, header.value]),
        );
        const directives = Object.fromEntries(
            headers['Content-Security-Policy']
                .split(';')
                .map(directive => directive.trim())
                .filter(Boolean)
                .map(directive => {
                    const [name, ...values] = directive.split(/\s+/);
                    return [name, values.join(' ')];
                }),
        );

        expect(directives['script-src']).toBe("'self'");
        expect(directives['script-src']).not.toContain("'unsafe-inline'");
        expect(directives['connect-src']).toBe("'self' https://*.sentry.io");
        expect(directives['object-src']).toBe("'none'");
        expect(directives['base-uri']).toBe("'self'");
        expect(directives['form-action']).toBe("'self'");
        expect(directives['frame-ancestors']).toBe("'none'");
        expect(directives['worker-src']).toBe("'self' blob:");
        expect(headers['Content-Security-Policy']).not.toContain('googleapis');
        expect(headers['Content-Security-Policy']).not.toContain('gstatic');
        expect(headers['X-Frame-Options']).toBe('DENY');
    });

    test('denies camera, microphone, geolocation, payment and usb via Permissions-Policy', () => {
        const appHeadersRule = config.headers.find(rule => rule.source === '/(.*)');
        const headers = Object.fromEntries(
            appHeadersRule.headers.map(header => [header.key, header.value]),
        );

        expect(headers['Permissions-Policy']).toBe(
            'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        );
    });
});

// Vercel compiles `redirects` into routes with `getTransformedRoutes` from
// `@vercel/routing-utils` (path-to-regexp v6, strict and case-sensitive), so the test
// uses the same compiler. The edge then substitutes the numbered capture groups (`$1`,
// `$2`, ...) into the `Location` template; an unmatched optional group becomes empty.
// That substitution is done here by hand. The first matching route wins. Only the host-agnostic
// rows (the locale redirects) are checked here; the host-scoped step-1 rows have their own block.
const redirectRoutes = (() => {
    const { routes, error } = getTransformedRoutes({
        redirects: (config.redirects ?? []).filter(redirect => !redirect.has),
    });

    if (error) {
        throw new Error(error.message);
    }

    return routes ?? [];
})();

const resolveRedirect = pathname => {
    for (const route of redirectRoutes) {
        const match = new RegExp(route.src).exec(pathname);

        if (match) {
            return {
                destination: route.headers.Location.replace(
                    /\$(\d+)/g,
                    (_, index) => match[Number(index)] ?? '',
                ),
                statusCode: route.status,
            };
        }
    }

    return undefined;
};

describe('Vercel redirects for removed public locales (#609)', () => {
    test.each([
        ['/es', '/'],
        ['/es/', '/'],
        ['/es/privacy', '/privacy'],
        ['/es/privacy/', '/privacy'],
        ['/pt-br', '/'],
        ['/pt-br/', '/'],
        ['/pt-br/privacy', '/privacy'],
        ['/pt-br/privacy/', '/privacy'],
        ['/pt-pt', '/'],
        ['/pt-pt/', '/'],
        ['/pt-pt/privacy', '/privacy'],
        ['/pt-pt/privacy/', '/privacy'],
        ['/pt-BR', '/'],
        ['/pt-BR/', '/'],
        ['/pt-BR/privacy', '/privacy'],
        ['/pt-BR/privacy/', '/privacy'],
        ['/pt-PT', '/'],
        ['/pt-PT/', '/'],
        ['/pt-PT/privacy', '/privacy'],
        ['/pt-PT/privacy/', '/privacy'],
        ['/es/terms', '/terms'],
    ])('permanently redirects %s to the English page %s', (source, destination) => {
        expect(resolveRedirect(source)).toEqual({ destination, statusCode: 301 });
    });

    test.each([
        '/',
        '/ru/',
        '/ru/privacy',
        '/privacy',
        '/estonia',
        '/pt',
        '/dashboard/es',
        '/ES/',
        // Never emit a protocol-relative Location (open redirect).
        '/es//',
        '/es//example.com',
    ])('leaves %s untouched', pathname => {
        expect(resolveRedirect(pathname)).toBeUndefined();
    });
});

// 04-4a1 (spec 04 §2.11 option (a)): `dist` has no file at `/sw.js`, so the host decides which
// worker script `/sw.js` serves. All routes (redirects, then rewrites after `handle: filesystem`)
// come from `getTransformedRoutes`; a route applies when its `has` host condition holds. Routes
// with `continue` (headers) do not end the match. The first matching route wins.
const allRoutes = (() => {
    const { routes, error } = getTransformedRoutes({
        redirects: config.redirects ?? [],
        rewrites: config.rewrites ?? [],
    });

    if (error) {
        throw new Error(error.message);
    }

    return (routes ?? []).filter(route => route.src && !route.continue);
})();

const hostMatches = (route, host) =>
    (route.has ?? []).every(condition => hostConditionMatches(condition, host));

// A route matches the pathname only. A redirect's `Location` gets the numbered capture groups
// substituted (as in `resolveRedirect` above), and Vercel appends the request's query string to a
// destination that has none, so `url` may carry a query and the redirect keeps it. The helper
// assumes that runtime behaviour (L2 of the 04-4a2 review); the blocking dev smoke curl of
// `/oauth/callback?code=x&returnTo=…` in DEPLOYMENT.md verifies it before Promote.
const resolveRoute = (host, url) => {
    const queryIndex = url.indexOf('?');
    const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : url.slice(queryIndex);
    const route = allRoutes.find(
        candidate => hostMatches(candidate, host) && new RegExp(candidate.src).test(pathname),
    );

    if (!route) {
        return undefined;
    }

    if (!route.status) {
        return { rewrite: route.dest.split('?')[0] };
    }

    const match = new RegExp(route.src).exec(pathname);
    const location = route.headers.Location.replace(
        /\$(\d+)/g,
        (_, index) => match[Number(index)] ?? '',
    );

    return {
        redirect: location.includes('?') ? location : location + query,
        statusCode: route.status,
    };
};

const LEGACY_HOSTS = ['chipin.one', 'dev.chipin.one'];
const APP_WORKER_HOSTS = [
    'app.chipin.one',
    'app-dev.chipin.one',
    'chipin-git-feature-123.vercel.app',
    'chipin-frontend.vercel.app',
    'localhost',
];

describe('Vercel /sw.js by host (04-4a1)', () => {
    test.each(APP_WORKER_HOSTS)('serves the app worker /sw-app.js at /sw.js on %s', host => {
        expect(resolveRoute(host, '/sw.js')).toEqual({ rewrite: '/sw-app.js' });
    });

    test.each(LEGACY_HOSTS)('serves the kill-switch /sw-kill.js at /sw.js on %s', host => {
        expect(resolveRoute(host, '/sw.js')).toEqual({ rewrite: '/sw-kill.js' });
    });

    test.each([...LEGACY_HOSTS, ...APP_WORKER_HOSTS])(
        'leaves the worker files on %s to the filesystem (no redirect, no SPA rewrite)',
        host => {
            expect(resolveRoute(host, '/sw-app.js')).toBeUndefined();
            expect(resolveRoute(host, '/sw-kill.js')).toBeUndefined();
        },
    );

    test('serves the kill-switch on exactly the hosts the registration gate denies', () => {
        const killSwitchHosts = [...LEGACY_HOSTS, ...APP_WORKER_HOSTS].filter(
            host => resolveRoute(host, '/sw.js')?.rewrite === '/sw-kill.js',
        );
        const hostConditions = config.rewrites
            .filter(rewrite => rewrite.destination === '/sw-kill.js')
            .flatMap(rewrite => rewrite.has.map(exactHost));

        expect(killSwitchHosts.sort()).toEqual([...LEGACY_SERVICE_WORKER_HOSTNAMES].sort());
        expect(hostConditions.sort()).toEqual([...LEGACY_SERVICE_WORKER_HOSTNAMES].sort());
    });

    test('places the /sw.js rewrites after the last /api rewrite and before the SPA rewrites', () => {
        const indexes = config.rewrites.map((rewrite, index) => ({ ...rewrite, index }));
        const lastApiIndex = Math.max(
            ...indexes.filter(rewrite => rewrite.source === API_SOURCE).map(({ index }) => index),
        );
        const swIndexes = indexes
            .filter(rewrite => rewrite.source === '/sw.js')
            .map(({ index }) => index);
        const firstSpaIndex = Math.min(
            ...indexes
                .filter(rewrite => rewrite.destination === '/app.html')
                .map(({ index }) => index),
        );

        expect(swIndexes).toHaveLength(3);
        expect(swIndexes.every(index => index > lastApiIndex && index < firstSpaIndex)).toBe(true);
    });
});

// 04-4a2 (spec 04 §2.9, §4.2 step 1): while the legacy hosts are in the app project, their private
// app paths 302 to the app host of the same environment with the same path and query. Nothing on
// the app hosts or previews is redirected except the locale 301 rows.
const APP_HOSTS = ['app.chipin.one', 'app-dev.chipin.one'];
const PREVIEW_HOSTS = ['chipin-git-feature-123.vercel.app', 'chipin-frontend.vercel.app'];

const STEP_1_PATHS = [
    '/dashboard',
    '/dashboard/',
    '/dashboard/x',
    '/solo',
    '/solo/x',
    '/activity',
    '/activity/1',
    '/settings',
    '/settings/profile',
    '/group',
    '/group/1',
    '/group/join/token',
    '/friends',
    '/friends/join/token',
    '/oauth/callback',
    '/oauth/callback?code=x&returnTo=%2Fgroup%2F1',
    '/not-found',
];

// Every prefix of the enumerated SPA rewrites (`/dashboard/:path*` → `/dashboard`, `/dashboard/a/b`).
const spaRewritePaths = config.rewrites
    .filter(rewrite => rewrite.destination === '/app.html')
    .flatMap(({ source }) => {
        if (!source.endsWith('/:path*')) {
            return [source];
        }
        const prefix = source.slice(0, -'/:path*'.length);
        return [prefix, `${prefix}/x`, `${prefix}/a/b`];
    });

// Every prefix of PRIVATE_SPA_NAVIGATION_ALLOWLIST (`(?:dashboard|solo|…)` alternations and exact
// paths), with the variants each entry accepts.
const allowlistPaths = PRIVATE_SPA_NAVIGATION_ALLOWLIST.flatMap(regex => {
    const group = /^\^\\\/\(\?:([a-z|-]+)\)/.exec(regex.source);
    const literal = /^\^\\\/([a-z-]+)\$$/.exec(regex.source);
    const prefixes = group
        ? group[1].split('|').map(name => `/${name}`)
        : literal
          ? [`/${literal[1]}`]
          : [];

    if (prefixes.length === 0) {
        throw new Error(`Unrecognized allowlist entry ${regex}`);
    }

    return prefixes
        .flatMap(prefix => [prefix, `${prefix}/`, `${prefix}/x`])
        .filter(path => regex.test(path));
});

const NEVER_REDIRECTED_PATHS = [
    '/',
    '/?utm_source=x',
    '/privacy',
    '/terms',
    '/ru',
    '/ru/',
    '/ru/privacy',
    '/ru/terms',
    '/api/auth/refresh',
    '/api/stats',
    '/assets/index-abc123.js',
    '/sw.js',
    '/sw-kill.js',
    '/sw-app.js',
    '/favicon.ico',
    '/pwa-192x192.png',
    '/apple-touch-icon-180x180.png',
    '/.well-known/assetlinks.json',
    '/robots.txt',
    '/sitemap.xml',
    '/dashboardx',
    '/Dashboard',
    '/not-found/x',
];

// On the app hosts and previews the manifest is a plain file (#758 redirects it only on the legacy
// hosts, see the block below).
const APP_HOST_ONLY_PATHS = ['/manifest.webmanifest'];

const legacyHostAppOrigin = host => LEGACY_HOST_APP_ORIGINS[host];

describe('Vercel step-1 legacy redirects (04-4a2)', () => {
    test('the legacy hosts are the hosts of the service worker kill-switch', () => {
        expect([...LEGACY_HOSTS].sort()).toEqual([...LEGACY_SERVICE_WORKER_HOSTNAMES].sort());
        expect(Object.keys(LEGACY_HOST_APP_ORIGINS).sort()).toEqual([...LEGACY_HOSTS].sort());
    });

    test('derives the prefixes of the SPA rewrites and of the allowlist', () => {
        expect(spaRewritePaths).toEqual(expect.arrayContaining(['/dashboard', '/not-found']));
        expect(allowlistPaths).toEqual(expect.arrayContaining(['/oauth', '/not-found']));
    });

    test.each(
        LEGACY_HOSTS.flatMap(host =>
            [...new Set([...STEP_1_PATHS, ...spaRewritePaths, ...allowlistPaths])].map(path => [
                host,
                path,
            ]),
        ),
    )('on %s redirects %s to the app host with 302, same path and query', (host, path) => {
        expect(resolveRoute(host, path)).toEqual({
            redirect: `${legacyHostAppOrigin(host)}${path}`,
            statusCode: 302,
        });
    });

    test.each(LEGACY_HOSTS)('on %s keeps the OAuth code and returnTo', host => {
        expect(resolveRoute(host, '/oauth/callback?code=x&returnTo=%2Fgroup%2F1')?.redirect).toBe(
            `${legacyHostAppOrigin(host)}/oauth/callback?code=x&returnTo=%2Fgroup%2F1`,
        );
    });

    test.each(LEGACY_HOSTS)('on %s redirects /app.html to the app host root', host => {
        expect(resolveRoute(host, '/app.html')).toEqual({
            redirect: `${legacyHostAppOrigin(host)}/`,
            statusCode: 302,
        });
    });

    test.each(LEGACY_HOSTS.flatMap(host => NEVER_REDIRECTED_PATHS.map(path => [host, path])))(
        'on %s never redirects %s',
        (host, path) => {
            expect(resolveRoute(host, path)?.redirect).toBeUndefined();
        },
    );

    test.each([...APP_HOSTS, ...PREVIEW_HOSTS, 'localhost'])(
        'has no redirect on %s except the locale 301 rows',
        host => {
            const hostRedirects = allRoutes.filter(
                route => route.status && hostMatches(route, host),
            );

            expect(hostRedirects.length).toBeGreaterThan(0);
            expect(hostRedirects.every(route => route.status === 301 && !route.has)).toBe(true);
            expect(resolveRoute(host, '/dashboard')).toEqual({ rewrite: '/app.html' });
            expect(resolveRoute(host, '/app.html')).toBeUndefined();
            for (const path of [
                ...STEP_1_PATHS,
                ...NEVER_REDIRECTED_PATHS,
                ...APP_HOST_ONLY_PATHS,
            ]) {
                expect(resolveRoute(host, path)?.redirect).toBeUndefined();
            }
        },
    );

    // M1 of the 04-4a2 review: `getPublicRoute` does not know `/index.html`-style URLs, so the
    // prerender file served there would boot the full app (and its session check) on the legacy
    // host. They go to the directory path of the same host, which the prerender serves with 200.
    test.each(
        LEGACY_HOSTS.flatMap(host =>
            [
                ['/index.html', '/'],
                ['/index.html?utm_source=x', '/?utm_source=x'],
                ['/privacy/index.html', '/privacy'],
                ['/terms/index.html', '/terms'],
                ['/ru/index.html', '/ru'],
                ['/ru/index.html?a=1&b=2', '/ru?a=1&b=2'],
                ['/ru/privacy/index.html', '/ru/privacy'],
                ['/ru/terms/index.html', '/ru/terms'],
            ].map(([path, target]) => [host, path, target]),
        ),
    )('on %s redirects %s to %s on the same host with 302', (host, path, target) => {
        expect(resolveRoute(host, path)).toEqual({ redirect: target, statusCode: 302 });
    });

    test.each(LEGACY_HOSTS)('on %s never emits a protocol-relative index.html redirect', host => {
        expect(resolveRoute(host, '//example.com/index.html')?.redirect).toBeUndefined();
    });

    test.each(LEGACY_HOSTS)('on %s sends /dashboard/index.html to the app host', host => {
        expect(resolveRoute(host, '/dashboard/index.html')).toEqual({
            redirect: `${legacyHostAppOrigin(host)}/dashboard/index.html`,
            statusCode: 302,
        });
    });

    test.each([...APP_HOSTS, ...PREVIEW_HOSTS, 'localhost'])(
        'leaves the index.html paths on %s untouched',
        host => {
            for (const path of ['/index.html', '/privacy/index.html', '/ru/index.html']) {
                expect(resolveRoute(host, path)?.redirect).toBeUndefined();
            }
        },
    );

    // L1 of the 04-4a2 review: an unanchored `chipin.one` condition would match the app host and
    // send `app.chipin.one/dashboard` to itself forever.
    test.each(APP_HOSTS)('serves %s/dashboard with no redirect (no loop)', host => {
        expect(resolveRoute(host, '/dashboard')).toEqual({ rewrite: '/app.html' });
    });

    test('writes every named host condition as an exact { eq } match', () => {
        const hostConditions = ['redirects', 'rewrites', 'headers'].flatMap(key =>
            config[key].flatMap(rule =>
                (rule.has ?? []).filter(condition => condition.type === 'host'),
            ),
        );

        expect(hostConditions.length).toBeGreaterThan(0);
        for (const condition of hostConditions) {
            expect(typeof condition.value).toBe('object');
            expect(Object.keys(condition.value)).toHaveLength(1);
            if (condition.value.eq !== undefined) {
                expect(condition.value.eq).toMatch(/^[a-z-]+(\.[a-z-]+)+$/);
            } else {
                expect(condition.value).toEqual({ suf: '.vercel.app' });
            }
        }
    });

    test('every step-1 redirect is a host-scoped 302 to the app host of its environment', () => {
        const step1 = config.redirects.filter(redirect => redirect.has);

        expect(step1.length).toBeGreaterThan(0);
        for (const redirect of step1) {
            const [condition] = redirect.has;
            const host = exactHost(condition);

            expect(redirect.has).toHaveLength(1);
            expect(redirect.statusCode).toBe(302);
            expect(LEGACY_HOSTS).toContain(host);
            // Either to the app host of the same environment, or (`/index.html`) a relative path
            // on the same host.
            expect(
                redirect.destination.startsWith(`${legacyHostAppOrigin(host)}/`) ||
                    (redirect.destination.startsWith('/') &&
                        !redirect.destination.startsWith('//')),
            ).toBe(true);
        }
    });
});

// #758: the legacy hosts keep the landing but must not be installable as the app: iOS installed
// `chipin.one` (scope `/`) as a standalone app whose sign-in opens the app host in an in-app sheet,
// so the session never reaches the icon. `dist` has `/manifest.webmanifest` and Vercel runs the
// rewrites after `handle: filesystem`, so a host-scoped rewrite cannot hide the file. The redirects
// run before the filesystem: on the legacy hosts the manifest 302s to a path that is neither a
// file nor a rewrite source, which Vercel answers with 404, so the browser gets no manifest. The
// app hosts, previews and localhost keep the file with its headers.
const LEGACY_HOST_MISSING_MANIFEST = '/legacy-host-has-no-manifest';

describe('Vercel /manifest.webmanifest by host (#758)', () => {
    test.each(LEGACY_HOSTS)('on %s redirects the manifest to a path that 404s', host => {
        expect(resolveRoute(host, '/manifest.webmanifest')).toEqual({
            redirect: LEGACY_HOST_MISSING_MANIFEST,
            statusCode: 302,
        });
        expect(resolveRoute(host, LEGACY_HOST_MISSING_MANIFEST)).toBeUndefined();
    });

    test.each([...APP_HOSTS, ...PREVIEW_HOSTS, 'localhost'])(
        'on %s serves the manifest file itself (no redirect, no rewrite)',
        host => {
            expect(resolveRoute(host, '/manifest.webmanifest')).toBeUndefined();
        },
    );

    test('redirects the manifest on exactly the legacy hosts', () => {
        const manifestHosts = config.redirects
            .filter(redirect => redirect.source === '/manifest.webmanifest')
            .flatMap(redirect => redirect.has.map(exactHost));

        expect(manifestHosts.sort()).toEqual([...LEGACY_SERVICE_WORKER_HOSTNAMES].sort());
        expect(Object.keys(LEGACY_HOST_APP_ORIGINS).sort()).toEqual(manifestHosts);
    });

    // On the legacy hosts the 302 is terminal, so only the hosts that serve the file are checked.
    test.each([...APP_HOSTS, ...PREVIEW_HOSTS, 'localhost'])(
        'keeps the manifest headers on %s',
        host => {
            expect(resolveHeaders(host, '/manifest.webmanifest')).toMatchObject({
                'Content-Type': 'application/manifest+json',
                'Cache-Control': 'public, max-age=3600, immutable',
            });
        },
    );
});

const headerRoutes = (() => {
    const { routes, error } = getTransformedRoutes({ headers: config.headers ?? [] });

    if (error) {
        throw new Error(error.message);
    }

    return routes ?? [];
})();

const resolveHeaders = (host, pathname) =>
    Object.assign(
        {},
        ...headerRoutes
            .filter(route => hostMatches(route, host) && new RegExp(route.src).test(pathname))
            .map(route => route.headers),
    );

describe('Vercel step-1 headers (04-4a2)', () => {
    test.each(
        [...APP_HOSTS, ...PREVIEW_HOSTS].flatMap(host =>
            ['/', '/dashboard', '/group/1', '/api/health', '/sw.js'].map(path => [host, path]),
        ),
    )('marks %s%s noindex, nofollow', (host, path) => {
        expect(resolveHeaders(host, path)['X-Robots-Tag']).toBe('noindex, nofollow');
    });

    test.each(
        LEGACY_HOSTS.flatMap(host =>
            ['/', '/privacy', '/ru/', '/robots.txt', '/.well-known/assetlinks.json', '/sw.js'].map(
                path => [host, path],
            ),
        ),
    )('keeps %s%s indexable', (host, path) => {
        expect(resolveHeaders(host, path)['X-Robots-Tag']).toBeUndefined();
    });

    test.each([...LEGACY_HOSTS, ...APP_HOSTS, ...PREVIEW_HOSTS])(
        'serves /sw.js on %s with Cache-Control: no-cache',
        host => {
            expect(resolveHeaders(host, '/sw.js')['Cache-Control']).toBe('no-cache');
        },
    );

    test('keeps the security headers on every host', () => {
        for (const host of [...LEGACY_HOSTS, ...APP_HOSTS, ...PREVIEW_HOSTS]) {
            expect(resolveHeaders(host, '/')['X-Frame-Options']).toBe('DENY');
        }
    });
});

const ASSET_LINK_SITES = [
    'https://app-dev.chipin.one',
    'https://app.chipin.one',
    'https://chipin.one',
    'https://dev.chipin.one',
];

const readAssetLinkSites = path =>
    JSON.parse(readFileSync(path, 'utf8'))
        .map(entry => entry.target.site)
        .sort();

test('assetlinks.json lists the legacy and the app hosts (04-4a2)', () => {
    expect(
        readAssetLinkSites(resolve(import.meta.dirname, 'public/.well-known/assetlinks.json')),
    ).toEqual(ASSET_LINK_SITES);
});

// Runs against a built `dist` only (`npm run build` runs `verify:public-precache`, which checks
// the same files on every build, including Vercel's).
describe.runIf(existsSync(resolve(DIST, 'index.html')))('built dist worker files (04-4a1)', () => {
    test('has sw-app.js and sw-kill.js and no sw.js', () => {
        expect(existsSync(resolve(DIST, 'sw-app.js'))).toBe(true);
        expect(existsSync(resolve(DIST, 'sw-kill.js'))).toBe(true);
        expect(existsSync(resolve(DIST, 'sw.js'))).toBe(false);
    });

    test('has the manifest and no file at the legacy-host manifest target (#758)', () => {
        expect(existsSync(resolve(DIST, 'manifest.webmanifest'))).toBe(true);
        expect(existsSync(resolve(DIST, LEGACY_HOST_MISSING_MANIFEST.slice(1)))).toBe(false);
    });

    test('copies assetlinks.json with the legacy and the app hosts (04-4a2)', () => {
        expect(readAssetLinkSites(resolve(DIST, '.well-known/assetlinks.json'))).toEqual(
            ASSET_LINK_SITES,
        );
    });
});

// 04-0a: Vercel builds with Root Directory apps/app; the install runs at the workspace root from
// the root lockfile, like CI (a workspace-scoped install misses the root tooling, husky fails).
test('installs from the workspace root lockfile', () => {
    expect(config.installCommand).toBe('cd ../.. && npm ci');
});
