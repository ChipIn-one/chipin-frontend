// Kill-switch apps/site/public/sw.js (spec 04 §3.6, 04-3d): evaluated as a classic worker script
// against fake `self`, `caches`, `registration` and `clients`, as apps/app/scripts/sw-kill.test.mjs
// does for the app's copy (04-4a1).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { describe, expect, test, vi } from 'vitest';

const SITE_DIR = fileURLToPath(new URL('../..', import.meta.url));
const KILL_SWITCH_SOURCE = readFileSync(join(SITE_DIR, 'public/sw.js'), 'utf8');
const APP_KILL_SWITCH_SOURCE = readFileSync(join(SITE_DIR, '../app/public/sw-kill.js'), 'utf8');

interface FakeEvent {
    waitUntil: (promise: Promise<unknown>) => void;
}

type Listener = (event: FakeEvent) => void;

const DASHBOARD_WINDOWS = ['https://chipin.one/dashboard?tab=0', 'https://chipin.one/group/1'];

const loadKillSwitch = ({
    cacheNames = ['workbox-precache-v2', 'runtime'],
    windowUrls = DASHBOARD_WINDOWS,
}: { cacheNames?: string[]; windowUrls?: string[] } = {}) => {
    const cacheStore = new Map(cacheNames.map(name => [name, {}]));
    const listeners = new Map<string, Listener[]>();
    const windowClients = windowUrls.map(url => ({
        url,
        navigate: vi.fn((_url: string) => Promise.resolve(null)),
    }));
    const indexedDB = { open: vi.fn(), deleteDatabase: vi.fn() };
    const localStorage = { clear: vi.fn(), removeItem: vi.fn() };
    const self = {
        addEventListener: vi.fn((type: string, listener: Listener) => {
            listeners.set(type, [...(listeners.get(type) ?? []), listener]);
        }),
        caches: {
            keys: vi.fn(() => Promise.resolve([...cacheStore.keys()])),
            delete: vi.fn((name: string) => Promise.resolve(cacheStore.delete(name))),
        },
        clients: {
            matchAll: vi.fn((_options: { type: string }) => Promise.resolve(windowClients)),
        },
        indexedDB,
        localStorage,
        registration: {
            unregister: vi.fn(() => Promise.resolve(true)),
        },
        skipWaiting: vi.fn(() => Promise.resolve()),
    };

    runInNewContext(KILL_SWITCH_SOURCE, { self, indexedDB, localStorage, URL });

    const dispatch = (type: string) => {
        let done: Promise<unknown> = Promise.resolve();
        const event = {
            waitUntil: vi.fn((promise: Promise<unknown>) => {
                done = promise;
            }),
        };

        for (const listener of listeners.get(type) ?? []) {
            listener(event);
        }

        return { event, done };
    };

    return { cacheStore, dispatch, indexedDB, listeners, localStorage, self, windowClients };
};

/** The script without its comments: the code the worker runs. */
const code = (source: string): string =>
    source
        .replace(/^\s*\/\/.*$/gm, '')
        .split('\n')
        .filter(line => line.trim() !== '')
        .join('\n');

describe('site kill-switch sw.js', () => {
    // §2.11, §3.6: one kill-switch code for both projects; the comments differ (who serves it).
    test('runs the same code as the app kill-switch apps/app/public/sw-kill.js', () => {
        expect(code(KILL_SWITCH_SOURCE)).toBe(code(APP_KILL_SWITCH_SOURCE));
    });

    test('calls skipWaiting on install', () => {
        const { dispatch, self } = loadKillSwitch();

        dispatch('install');

        expect(self.skipWaiting).toHaveBeenCalledTimes(1);
    });

    test('registers no fetch listener', () => {
        const { listeners } = loadKillSwitch();

        expect([...listeners.keys()].sort()).toEqual(['activate', 'install']);
    });

    test('on activate empties every cache, unregisters, then reloads each window once', async () => {
        const { cacheStore, dispatch, self, windowClients } = loadKillSwitch();

        const { event, done } = dispatch('activate');

        expect(event.waitUntil).toHaveBeenCalledTimes(1);
        await done;

        expect(cacheStore.size).toBe(0);
        expect(self.registration.unregister).toHaveBeenCalledTimes(1);
        expect(self.clients.matchAll).toHaveBeenCalledWith({ type: 'window' });
        for (const client of windowClients) {
            expect(client.navigate).toHaveBeenCalledExactlyOnceWith(client.url);
        }

        const lastDelete = Math.max(...self.caches.delete.mock.invocationCallOrder);
        const [unregister = 0] = self.registration.unregister.mock.invocationCallOrder;
        const [matchAll = 0] = self.clients.matchAll.mock.invocationCallOrder;

        expect(lastDelete).toBeLessThan(unregister);
        expect(unregister).toBeLessThan(matchAll);
    });

    test('unregisters even when the origin has no caches', async () => {
        const { dispatch, self } = loadKillSwitch({ cacheNames: [], windowUrls: [] });

        await dispatch('activate').done;

        expect(self.registration.unregister).toHaveBeenCalledTimes(1);
    });

    test('never touches IndexedDB or localStorage', async () => {
        const { dispatch, indexedDB, localStorage } = loadKillSwitch();

        dispatch('install');
        await dispatch('activate').done;

        expect(indexedDB.open).not.toHaveBeenCalled();
        expect(indexedDB.deleteDatabase).not.toHaveBeenCalled();
        expect(localStorage.clear).not.toHaveBeenCalled();
        expect(localStorage.removeItem).not.toHaveBeenCalled();
        expect(code(KILL_SWITCH_SOURCE)).not.toMatch(/indexedDB|localStorage/i);
    });

    test('one rejected navigate does not stop the other windows from reloading', async () => {
        const { dispatch, windowClients } = loadKillSwitch({
            windowUrls: [
                'https://chipin.one/dashboard',
                'https://chipin.one/group/1',
                'https://chipin.one/settings',
            ],
        });
        windowClients[0]?.navigate.mockRejectedValueOnce(new TypeError('not controlled'));

        await expect(dispatch('activate').done).resolves.toBeDefined();

        for (const client of windowClients) {
            expect(client.navigate).toHaveBeenCalledExactlyOnceWith(client.url);
        }
    });

    test('does not reload an OAuth callback window (its one-time code is spent)', async () => {
        const { cacheStore, dispatch, self, windowClients } = loadKillSwitch({
            windowUrls: ['https://chipin.one/oauth/callback?code=x', 'https://chipin.one/'],
        });
        const [oauthWindow, homeWindow] = windowClients;

        await dispatch('activate').done;

        expect(oauthWindow?.navigate).not.toHaveBeenCalled();
        expect(homeWindow?.navigate).toHaveBeenCalledExactlyOnceWith('https://chipin.one/');
        expect(cacheStore.size).toBe(0);
        expect(self.registration.unregister).toHaveBeenCalledTimes(1);
    });
});

/** Files under `dir` (relative paths), skipping dependency and build-cache folders. */
const listFiles = (dir: string): string[] =>
    readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => relative(dir, join(entry.parentPath, entry.name)))
        .filter(file => !/(?:^|\/)(?:node_modules|\.astro)\//.test(file));

// §3.6: the site registers no worker; `public/sw.js` only replaces the old app registration.
describe('the site registers no worker', () => {
    const SOURCE_DIRS = ['src', 'integrations'];

    test.each(SOURCE_DIRS)('no file under apps/site/%s registers a service worker', dir => {
        const offenders = listFiles(join(SITE_DIR, dir))
            .filter(file => !file.endsWith('.test.ts'))
            .filter(file => /serviceWorker/.test(readFileSync(join(SITE_DIR, dir, file), 'utf8')));

        expect(offenders).toEqual([]);
    });

    test('public/ holds no worker script but the kill-switch', () => {
        const scripts = listFiles(join(SITE_DIR, 'public')).filter(file => /\.m?js$/.test(file));

        expect(scripts).toEqual(['sw.js']);
    });

    // Runs against a built `dist` only (`npm run build -w @chipin/site`).
    test.runIf(existsSync(join(SITE_DIR, 'dist/index.html')))(
        'no built page or script registers a service worker',
        () => {
            const dist = join(SITE_DIR, 'dist');
            const offenders = listFiles(dist)
                .filter(file => /\.(?:html|m?js)$/.test(file) && file !== 'sw.js')
                .filter(file => /serviceWorker/.test(readFileSync(join(dist, file), 'utf8')));

            expect(offenders).toEqual([]);
        },
    );
});
