import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from 'constants/locales';

import { APP_ROUTES } from './routeManifest';

// The node-importability of the manifest (§2.2) is checked by scripts/routeManifest.node.test.mjs.

const META_FILES = import.meta.glob('../../i18n/locales/*/meta.json', {
    eager: true,
    import: 'default',
});

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
    it('has unique ids and unique paths', () => {
        const ids = APP_ROUTES.map(route => route.id);
        const paths = APP_ROUTES.map(route => route.path);

        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(paths).size).toBe(paths.length);
    });

    it('has the protected `home` index of 04-5a', () => {
        expect(APP_ROUTES.find(route => route.path === '')).toMatchObject({
            id: 'home',
            access: 'protected',
            layout: 'internal',
        });
    });

    it('uses relative paths', () => {
        for (const route of APP_ROUTES) {
            expect(route.path.startsWith('/')).toBe(false);
        }
    });

    // 04-5b: the manifest is the only route table of the app (`ROUTE_META` is gone); the `home`
    // index only redirects to the preferred mode.
    it('lists the app routes with their title keys', () => {
        expect(
            APP_ROUTES.map(({ id, path, access, layout, meta }) => [
                id,
                path,
                access,
                layout,
                meta.titleKey,
                meta.entityTitleKey,
            ]),
        ).toEqual([
            ['home', '', 'protected', 'internal', 'dashboard.title', undefined],
            ['login', 'login', 'public', 'bare', 'login.title', undefined],
            ['oauthCallback', 'oauth/callback', 'public', 'bare', 'oauthCallback.title', undefined],
            ['dashboard', 'dashboard', 'protected', 'internal', 'dashboard.title', undefined],
            ['solo', 'solo', 'protected', 'internal', 'solo.title', undefined],
            [
                'group',
                'group/:groupId',
                'protected',
                'internal',
                'group.title',
                'group.titleWithName',
            ],
            [
                'groupJoin',
                'group/join/:inviteToken',
                'protected',
                'bare',
                'groupJoin.title',
                undefined,
            ],
            ['activity', 'activity', 'protected', 'internal', 'activity.title', undefined],
            [
                'activityDetails',
                'activity/:parentActivityId',
                'protected',
                'internal',
                'activityDetails.title',
                undefined,
            ],
            ['friends', 'friends', 'protected', 'internal', 'friends.title', undefined],
            [
                'friendJoin',
                'friends/join/:inviteToken',
                'protected',
                'bare',
                'friends.title',
                undefined,
            ],
            ['settings', 'settings', 'protected', 'internal', 'settings.title', undefined],
            ['notFound', 'not-found', 'public', 'bare', 'notFound.title', undefined],
        ]);
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
