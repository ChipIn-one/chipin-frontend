import type { QueryClient } from '@tanstack/react-query';

import { activityKeys } from 'entities/activity';
import { dashboardKeys } from 'entities/dashboard';
import { clearLocalUserIdentity, resetTabUserId, saveLocalUser } from 'helpers/localStorage';
import { cachesByUser } from 'shared/offline/userCaches';

import { createTestQueryClient } from './renderWithQueryClient';

const USER_ID = 'dashboard-cache-user';
const SELF_FEEDS = [activityKeys.self({ view: 'previews' }), activityKeys.self({ view: 'events' })];

export interface UserDashboardCache {
    client: QueryClient;
    /** Whether the cached dashboard balances were marked stale (the legacy store bridge). */
    isDashboardInvalidated: () => boolean;
    /** Whether both cached feeds of the user's own activity were marked stale. */
    isSelfActivityInvalidated: () => boolean;
    dispose: () => void;
}

/**
 * A signed-in user (`LocalUser.id`) whose QueryClient is registered as `clientFor` does it, with
 * the dashboard balances and the user's own activity feeds (previews and flat log) in its cache.
 */
export const mountUserDashboardCache = (): UserDashboardCache => {
    const client = createTestQueryClient();

    client.setQueryData(dashboardKeys.balances(), []);
    SELF_FEEDS.forEach(key => {
        client.setQueryData(key, { pages: [{ items: [], nextCursor: null }], pageParams: [null] });
    });
    saveLocalUser({
        id: USER_ID,
        settings: {
            defaultCurrency: 'USD',
            defaultCategory: 'food',
            timeFormat: '24h',
            language: 'en',
            theme: 'system',
            simplifyDebts: true,
            skipCategory: false,
            soloModeByDefault: false,
            saveGroupExpensesToSolo: false,
            sex: 'male',
        },
    });
    cachesByUser.set(USER_ID, {
        client,
        ready: Promise.resolve(),
        isReady: true,
        listeners: new Set(),
        unsubscribe: null,
        disposed: false,
    });

    return {
        client,
        isDashboardInvalidated: () =>
            client.getQueryState(dashboardKeys.balances())?.isInvalidated === true,
        isSelfActivityInvalidated: () =>
            SELF_FEEDS.every(key => client.getQueryState(key)?.isInvalidated === true),
        dispose: () => {
            cachesByUser.delete(USER_ID);
            client.clear();
            clearLocalUserIdentity();
            resetTabUserId();
        },
    };
};
