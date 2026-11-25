// The single source of "the network is usable" (spec 03 §1.7): TanStack `onlineManager`.
// `navigator.onLine` is read only here (lint `no-restricted-properties` outside shared/offline).
import * as Sentry from '@sentry/react';
import { onlineManager, type QueryClient } from '@tanstack/react-query';

import { probeBackendHealth } from 'shared/api/health';

/** While offline with `navigator.onLine === true` (captive portal, Wi-Fi without internet). */
export const OFFLINE_RECHECK_MS = 15_000;

export const isNetworkUsable = (): boolean => onlineManager.isOnline();

/** Resolves once the network is usable (immediately when it already is). */
export const waitForOnline = (): Promise<void> =>
    new Promise(resolve => {
        if (onlineManager.isOnline()) {
            resolve();
            return;
        }
        const unsubscribe = onlineManager.subscribe(online => {
            if (online) {
                unsubscribe();
                resolve();
            }
        });
    });

// The work each client waits to run once the network is back, by name: one waiter per client,
// keyed by the client object, so another client (an account switch) never runs or keeps it.
const tasksAwaitingOnline = new WeakMap<QueryClient, Map<string, () => void>>();

/**
 * Runs `task` once the network is usable (in a microtask when it already is), with every other
 * task of `client` waiting for it: one online waiter per client. A task added again under the
 * same `name` while it waits runs once; one that throws is reported (Sentry) and the others still
 * run. A task reads the cache when it runs: after a `client.clear()` it finds nothing.
 */
export const runWhenOnline = (client: QueryClient, name: string, task: () => void): void => {
    const waiting = tasksAwaitingOnline.get(client);

    if (waiting) {
        waiting.set(name, task);
        return;
    }
    const tasks = new Map([[name, task]]);

    tasksAwaitingOnline.set(client, tasks);
    void waitForOnline().then(() => {
        tasksAwaitingOnline.delete(client);
        tasks.forEach(run => {
            // A task that throws is reported and does not stop the others.
            try {
                run();
            } catch (error: unknown) {
                Sentry.captureException(error);
            }
        });
    });
};

// `performance.now()` of the last online-to-offline transition of `onlineManager` (the `offline`
// window event, an `offline` classification, an offline cold start; it notifies only on a change).
// A request sent before it says nothing about the network after it (#746).
let lastOfflineAt = Number.NEGATIVE_INFINITY;
onlineManager.subscribe(online => {
    if (!online) {
        lastOfflineAt = performance.now();
    }
});

/** When the app last went offline (`performance.now()`), `-Infinity` if it never did. */
export const getLastOfflineAt = (): number => lastOfflineAt;

const browserSaysOnline = (): boolean =>
    typeof navigator === 'undefined' || navigator.onLine !== false;

let recheckTimer: ReturnType<typeof setInterval> | null = null;

const stopRecheck = (): void => {
    if (recheckTimer !== null) {
        clearInterval(recheckTimer);
        recheckTimer = null;
    }
};

// A request classified `offline` (`setOnline(false)`) on a network the browser still calls online
// never gets an `online` event: probe `/health` (5 s timeout, shared with other probes sent during
// this outage) until any HTTP answer proves the network. The answer proves the network, not the
// backend: a non-2xx is classified by the reconnect refetch, not here. Only a probe sent during
// the current outage counts: one that a new outage overtook (back online and offline again while
// it ran) is ignored.
const recheck = (): void => {
    if (!browserSaysOnline()) {
        // The browser fires `online` itself.
        return;
    }
    const offlineAt = lastOfflineAt;
    void probeBackendHealth(offlineAt).then(health => {
        if (health !== 'unreachable' && lastOfflineAt === offlineAt) {
            onlineManager.setOnline(true);
        }
    });
};

const startRecheck = (): void => {
    if (recheckTimer === null) {
        recheckTimer = setInterval(recheck, OFFLINE_RECHECK_MS);
    }
};

let unsubscribeNetwork: (() => void) | null = null;

/**
 * Startup (before any request): `onlineManager` starts as online, so an offline cold start would
 * not pause queries until the first `offline` event. Then keeps the 15 s re-check running while
 * the network is not usable. Idempotent; returns the teardown (tests).
 */
export const bootstrapNetwork = (): (() => void) => {
    if (!unsubscribeNetwork) {
        onlineManager.setOnline(browserSaysOnline());
        const unsubscribe = onlineManager.subscribe(online => {
            if (online) {
                stopRecheck();
            } else {
                startRecheck();
            }
        });

        if (!onlineManager.isOnline()) {
            startRecheck();
        }
        unsubscribeNetwork = () => {
            unsubscribe();
            stopRecheck();
            unsubscribeNetwork = null;
        };
    }
    return unsubscribeNetwork;
};
