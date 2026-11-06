import type { QueryClient } from '@tanstack/react-query';

import { dashboardKeys } from 'entities/dashboard';
import { clearLocalUserIdentity, saveLocalUser } from 'helpers/localStorage';
import { cachesByUser } from 'shared/offline/userCaches';

import { createTestQueryClient } from './renderWithQueryClient';

const USER_ID = 'dashboard-cache-user';

export interface UserDashboardCache {
    client: QueryClient;
    /** Whether the cached dashboard queries were marked stale (the legacy store bridge). */
    isDashboardInvalidated: () => boolean;
    dispose: () => void;
}

/**
 * A signed-in user (`LocalUser.id`) whose QueryClient is registered as `clientFor` does it, with
 * the dashboard balances and feed in its cache.
 */
export const mountUserDashboardCache = (): UserDashboardCache => {
    const client = createTestQueryClient();

    client.setQueryData(dashboardKeys.balances(), []);
    client.setQueryData(dashboardKeys.activity(), {
        pages: [{ items: [], nextCursor: null }],
        pageParams: [null],
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
            [dashboardKeys.balances(), dashboardKeys.activity()].every(
                key => client.getQueryState(key)?.isInvalidated === true,
            ),
        dispose: () => {
            cachesByUser.delete(USER_ID);
            client.clear();
            clearLocalUserIdentity();
        },
    };
};
