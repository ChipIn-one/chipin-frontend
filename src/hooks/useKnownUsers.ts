// The known users (friends) and the premium promo for the UI (spec 03 §6 row 3). Like the self
// user (`useSelfUser`), the queries send a request only while signed in (online, or
// `offline-cached` reading the cache) and on the user's persisted client: the anonymous client of
// a first sign-in, before the user's client exists, never requests them. Signed out or on another
// client nothing is read.
import { useQueryClient } from '@tanstack/react-query';

import { type KnownUser, useKnownUsersQuery, usePremiumPromoQuery } from 'entities/users';
import { isUserCacheClient } from 'shared/offline/userCaches';
import { AUTH_STATUS, SESSION_MODE } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

const useIsSignedIn = (): boolean =>
    useAuthStore(state => state.status === AUTH_STATUS.AUTHENTICATED);

const useIsUserQueryEnabled = (): boolean => {
    const isSignedIn = useIsSignedIn();
    const isUserClient = isUserCacheClient(useQueryClient());

    return isSignedIn && isUserClient;
};

const identity = (friends: KnownUser[]): KnownUser[] => friends;

export interface KnownUsersResult {
    /** Undefined until the first load or while signed out. */
    friends: KnownUser[] | undefined;
    /** The first load failed, or it waits for the network, with nothing cached. */
    isError: boolean;
    /** Signed in, nothing cached yet and no error: the first load is pending. */
    isLoading: boolean;
    /** A refetch failed while data is shown (not a paused one: offline the banner says so). */
    hasRefreshError: boolean;
    /** Reloads the friends; does nothing while the query is disabled (signed out, another client). */
    refetch: () => Promise<unknown>;
}

const skipRefetch = (): Promise<undefined> => Promise.resolve(undefined);

/**
 * The friends with the query state a page needs: an error only without data (spec 03 §1.2), and
 * a fetch paused offline without data counts as an error (§1.8).
 */
export const useKnownUsers = (): KnownUsersResult => {
    const isSignedIn = useIsSignedIn();
    const isEnabled = useIsUserQueryEnabled();
    const isOnlineSession = useAuthStore(state => state.sessionMode === SESSION_MODE.ONLINE);
    const query = useKnownUsersQuery({
        select: identity,
        enabled: isEnabled,
        refetchOnReconnect: isOnlineSession,
    });
    const friends = isEnabled ? query.data : undefined;
    const isWaiting = isEnabled && friends === undefined;
    const isError = isWaiting && (query.isError || query.isPaused);

    return {
        friends,
        isError,
        // Signed in on the anonymous client (a first sign-in before the remount onto the user's
        // client) the friends are still to come: loading, never read from that client.
        isLoading: isSignedIn && friends === undefined && !isError,
        hasRefreshError: friends !== undefined && query.isError,
        refetch: isEnabled ? query.refetch : skipRefetch,
    };
};

export interface PremiumPromoResult {
    /** Unused promo places; null when unknown (not loaded, failed, signed out, another client). */
    remaining: number | null;
    /** The load has finished (with or without a value). */
    isResolved: boolean;
}

/**
 * The premium promo counter, requested only when `enabled` (a new user's first sign-in, until the
 * modal is dismissed).
 */
export const usePremiumPromo = (enabled: boolean): PremiumPromoResult => {
    const isUserQueryEnabled = useIsUserQueryEnabled();
    const query = usePremiumPromoQuery({ enabled: isUserQueryEnabled && enabled });

    if (!isUserQueryEnabled) {
        return { remaining: null, isResolved: false };
    }
    return { remaining: query.data ?? null, isResolved: query.isSuccess || query.isError };
};
