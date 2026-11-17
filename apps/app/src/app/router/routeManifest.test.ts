import { describe, expect, it } from 'vitest';

import { LOCALE_PREFIX, PUBLIC_PAGES, PUBLIC_ROUTE_ENTRIES } from 'constants/publicRouteManifest';
import { ROUTE_META, ROUTES } from 'constants/routes';

import { APP_ROUTES, type AppRouteId } from './routeManifest';
import manifestSource from './routeManifest.ts?raw';

// The non-public routes of the current AppRouter (features/routing/AppRouter.tsx), composed from
// ROUTES the same way the router composes them.
const CURRENT_ROUTER_PATHS = [
    ROUTES.OAUTH_CALLBACK,
    ROUTES.DASHBOARD,
    ROUTES.SOLO,
    `${ROUTES.GROUP}/:groupId`,
    `${ROUTES.GROUP_JOIN}/:inviteToken`,
    ROUTES.ACTIVITY,
    `${ROUTES.ACTIVITY}/:parentActivityId`,
    `${ROUTES.FRIENDS_JOIN}/:inviteToken`,
    ROUTES.FRIENDS,
    ROUTES.SETTINGS,
    ROUTES.NOT_FOUND_404,
];
const PUBLIC_PATHS = new Set(PUBLIC_ROUTE_ENTRIES.map(route => route.path));

// Spec 04 §2.2 table: the routes whose old chipin.one path is redirected to the app host.
const WITH_LEGACY_PATHS: readonly AppRouteId[] = [
    'oauthCallback',
    'dashboard',
    'solo',
    'group',
    'activity',
    'activityDetails',
    'friends',
    'settings',
];

const regular = APP_ROUTES.filter(route => !route.transitional);
const transitional = APP_ROUTES.filter(route => route.transitional);
const sorted = (values: readonly string[]) => [...values].sort();

describe('route manifest', () => {
    it('has unique ids and unique paths among regular and among transitional routes', () => {
        const ids = APP_ROUTES.map(route => route.id);

        expect(new Set(ids).size).toBe(ids.length);
        for (const group of [regular, transitional]) {
            const paths = group.map(route => route.path);

            expect(new Set(paths).size).toBe(paths.length);
        }
    });

    it('uses relative paths', () => {
        for (const route of APP_ROUTES) {
            expect(route.path.startsWith('/')).toBe(false);
        }
    });

    it('lists exactly the non-public routes the current router serves', () => {
        expect(sorted(regular.map(route => '/' + route.path))).toEqual(
            sorted(CURRENT_ROUTER_PATHS),
        );
    });

    it('matches the paths and title keys of ROUTE_META', () => {
        const privateMeta = ROUTE_META.filter(meta => !PUBLIC_PATHS.has(meta.path));

        expect(sorted(privateMeta.map(meta => meta.path))).toEqual(sorted(CURRENT_ROUTER_PATHS));
        for (const route of regular) {
            const meta = privateMeta.find(item => item.path === '/' + route.path);

            expect(route.meta.titleKey).toBe(meta?.titleKey);
            expect(route.meta.entityTitleKey).toBe(meta?.groupTitleKey);
        }
    });

    it('expands the transitional routes to exactly the public route entries', () => {
        const expanded = transitional.flatMap(route =>
            Object.values(LOCALE_PREFIX).map(prefix => prefix + '/' + route.path),
        );

        for (const route of transitional) {
            expect(route).toMatchObject({ access: 'public', layout: 'public', localePrefix: true });
        }
        expect(sorted(expanded)).toEqual(sorted([...PUBLIC_PATHS]));
    });

    it('takes the transitional title keys from the public pages', () => {
        for (const route of transitional) {
            const page = PUBLIC_PAGES.find(item => item.segment === route.path);

            expect(route.meta.titleKey).toBe(`${page?.metaKey}.title`);
        }
    });

    it('has legacy paths only for the routes of the §2.2 table, each its own path', () => {
        for (const route of APP_ROUTES) {
            const expected = WITH_LEGACY_PATHS.includes(route.id) ? ['/' + route.path] : [];

            expect(route.legacyPaths).toEqual(expected);
        }
    });

    it('has only type imports, so Node can import it without a build', () => {
        const imports = manifestSource.split('\n').filter(line => /^\s*import\b/.test(line));

        for (const line of imports) {
            expect(line).toMatch(/^\s*import type\b/);
        }
        expect(manifestSource).not.toMatch(/\brequire\(|\bimport\(/);
    });
});
