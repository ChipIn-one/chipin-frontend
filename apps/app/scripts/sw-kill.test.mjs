// Kill-switch public/sw-kill.js (spec 04 §2.11, §3.6; 04-4a1): evaluated as a classic worker
// script against fake `caches`, `registration` and `clients`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

import { expect, test, vi } from 'vitest';

const KILL_SWITCH_SOURCE = readFileSync(
    resolve(import.meta.dirname, '../public/sw-kill.js'),
    'utf8',
);

const DASHBOARD_WINDOWS = ['https://chipin.one/dashboard?tab=0', 'https://chipin.one/group/1'];

const loadKillSwitch = ({
    cacheNames = ['workbox-precache-v2', 'runtime'],
    windowUrls = DASHBOARD_WINDOWS,
} = {}) => {
    const cacheStore = new Map(cacheNames.map(name => [name, {}]));
    const listeners = new Map();
    const windowClients = windowUrls.map(url => ({
        url,
        navigate: vi.fn(() => Promise.resolve(null)),
    }));
    const indexedDB = { open: vi.fn(), deleteDatabase: vi.fn() };
    const localStorage = { clear: vi.fn(), removeItem: vi.fn() };
    const self = {
        addEventListener: vi.fn((type, listener) => {
            listeners.set(type, [...(listeners.get(type) ?? []), listener]);
        }),
        caches: {
            keys: vi.fn(() => Promise.resolve([...cacheStore.keys()])),
            delete: vi.fn(name => Promise.resolve(cacheStore.delete(name))),
        },
        clients: {
            matchAll: vi.fn(() => Promise.resolve(windowClients)),
        },
        indexedDB,
        localStorage,
        registration: {
            unregister: vi.fn(() => Promise.resolve(true)),
        },
        skipWaiting: vi.fn(() => Promise.resolve()),
    };

    runInNewContext(KILL_SWITCH_SOURCE, { self, indexedDB, localStorage, URL });

    const dispatch = type => {
        let pending = Promise.resolve();
        const event = {
            waitUntil: vi.fn(promise => {
                pending = promise;
            }),
        };

        for (const listener of listeners.get(type) ?? []) {
            listener(event);
        }

        return { event, done: pending };
    };

    return { cacheStore, dispatch, indexedDB, listeners, localStorage, self, windowClients };
};

test('calls skipWaiting on install', () => {
    const { dispatch, self } = loadKillSwitch();

    dispatch('install');

    expect(self.skipWaiting).toHaveBeenCalledTimes(1);
});

test('registers no fetch listener', () => {
    const { listeners } = loadKillSwitch();

    expect([...listeners.keys()].sort()).toEqual(['activate', 'install']);
    expect(listeners.has('fetch')).toBe(false);
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
        expect(client.navigate).toHaveBeenCalledTimes(1);
        expect(client.navigate).toHaveBeenCalledWith(client.url);
    }

    const [unregisterOrder] = self.registration.unregister.mock.invocationCallOrder;
    const [matchAllOrder] = self.clients.matchAll.mock.invocationCallOrder;
    const lastDeleteOrder = Math.max(...self.caches.delete.mock.invocationCallOrder);

    expect(lastDeleteOrder).toBeLessThan(unregisterOrder);
    expect(unregisterOrder).toBeLessThan(matchAllOrder);
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
    expect(KILL_SWITCH_SOURCE.replace(/^\s*\/\/.*$/gm, '')).not.toMatch(/indexedDB|localStorage/i);
});

test('one rejected navigate does not stop the other windows from reloading', async () => {
    const { dispatch, windowClients } = loadKillSwitch({
        windowUrls: [
            'https://chipin.one/dashboard',
            'https://chipin.one/group/1',
            'https://chipin.one/settings',
        ],
    });
    windowClients[0].navigate.mockRejectedValueOnce(new TypeError('not controlled'));

    await dispatch('activate').done;

    for (const client of windowClients) {
        expect(client.navigate).toHaveBeenCalledExactlyOnceWith(client.url);
    }
});

test('does not reload an OAuth callback window (its one-time code is spent)', async () => {
    const { cacheStore, dispatch, self, windowClients } = loadKillSwitch({
        windowUrls: ['https://chipin.one/oauth/callback?code=x', 'https://chipin.one/dashboard'],
    });

    await dispatch('activate').done;

    expect(windowClients[0].navigate).not.toHaveBeenCalled();
    expect(windowClients[1].navigate).toHaveBeenCalledExactlyOnceWith(windowClients[1].url);
    expect(cacheStore.size).toBe(0);
    expect(self.registration.unregister).toHaveBeenCalledTimes(1);
});
