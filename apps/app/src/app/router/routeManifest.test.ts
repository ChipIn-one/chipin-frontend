import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from 'constants/locales';
import { LOCALE_PREFIX, PUBLIC_PAGES, PUBLIC_ROUTE_ENTRIES } from 'constants/publicRouteManifest';
import { ROUTE_META } from 'constants/routes';

import { APP_ROUTES, type AppRouteId } from './routeManifest';

// The node-importability of the manifest (§2.2) is checked by scripts/routeManifest.node.test.mjs.

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

const META_FILES = import.meta.glob('../../i18n/locales/*/meta.json', {
    eager: true,
    import: 'default',
});

const regular = APP_ROUTES.filter(route => !route.transitional);
const transitional = APP_ROUTES.filter(route => route.transitional);
const sorted = (values: readonly string[]) => [...values].sort();

/** The value at a dotted key path of parsed JSON, or undefined. */
const valueAt = (json: unknown, path: string): unknown =>
    path
        .split('.')
        .reduce<unknown>(
            (node, key) =>
                typeof node === 'object' && node !== null
                    ? Object.entries(node).find(([name]) => name === key)?.[1]
                    : undefined,
            json,
        );

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

    it('lists exactly the non-public ROUTE_META routes, with their title keys', () => {
        const privateMeta = ROUTE_META.filter(meta => !PUBLIC_PATHS.has(meta.path));

        expect(sorted(regular.map(route => '/' + route.path))).toEqual(
            sorted(privateMeta.map(meta => meta.path)),
        );
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

    it('has every title key in the meta namespace of every locale', () => {
        expect(sorted(Object.keys(META_FILES))).toEqual(
            sorted(SUPPORTED_LOCALES.map(locale => `../../i18n/locales/${locale}/meta.json`)),
        );
        for (const [file, json] of Object.entries(META_FILES)) {
            for (const route of APP_ROUTES) {
                for (const key of [route.meta.titleKey, route.meta.entityTitleKey]) {
                    if (key !== undefined) {
                        expect(typeof valueAt(json, key), `${file}: ${key}`).toBe('string');
                    }
                }
            }
        }
    });
});
