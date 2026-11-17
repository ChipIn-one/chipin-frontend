// The users entity (spec 03 §1.2, §6 row 3): the self user, the known users (friends) and the
// premium promo counter, with the defaults below.
import type { QueryClient } from '@tanstack/react-query';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { getLocalUser, saveLocalUser, toLocalUser } from 'helpers/localStorage';
import { api } from 'shared/api/client';
import { refetchIfRestored } from 'shared/api/queryClient';

import { toKnownUsers } from '../model/toKnownUsers';
import { toSelfUser } from '../model/toSelfUser';
import type { KnownUser, SelfUser } from '../model/types';

/** The defaults table (spec 03 §1.2): fresh time and whether the entry is persisted. */
export const USERS_QUERY_DEFAULTS = {
    self: { staleTime: 5 * 60_000, persist: true },
    known: { staleTime: 60_000, persist: true },
    premiumPromo: { staleTime: 10 * 60_000, persist: false },
} as const;

export const usersKeys = {
    all: ['users'] as const,
    self: () => [...usersKeys.all, 'self'] as const,
    known: () => [...usersKeys.all, 'known'] as const,
    premiumPromo: () => [...usersKeys.all, 'premiumPromo'] as const,
};

// A refetch keeps the cached `LocalUser` in step, but only for the user it belongs to (after an
// account switch the previous user's response writes nothing), and it never brings back a role
// the cache dropped (an expiry clears it, spec 03 §1.5).
export const syncLocalUser = (user: SelfUser): SelfUser => {
    const cached = getLocalUser();

    if (cached?.id === user.id) {
        const next = toLocalUser(user);

        saveLocalUser(cached.role === undefined ? { id: next.id, settings: next.settings } : next);
    }
    return user;
};

/**
 * After the persisted cache is restored (#719): the cache is saved throttled, so a reload right
 * after a settings write can restore a self user older than the cached `LocalUser`, which every
 * confirmed value writes at once. The entry takes this user's cached language and theme (only
 * those: an account switch carries them, and only them, over to the next user's `LocalUser`). Its
 * update time and its invalidation are kept; the session load replaces it with the server value.
 */
export const reconcileRestoredSelf = (client: QueryClient, userId: string): void => {
    const cached = getLocalUser();
    const state = client.getQueryState<SelfUser>(usersKeys.self());
    const user = state?.data;

    if (cached?.id !== userId || !state || !user) {
        return;
    }
    const { language, theme } = cached.settings;
    // An empty language is unset (an older cached record): the restored one stays.
    const nextLanguage = language === '' ? user.settings.language : language;

    if (user.settings.language === nextLanguage && user.settings.theme === theme) {
        return;
    }
    client.setQueryData(
        usersKeys.self(),
        { ...user, settings: { ...user.settings, language: nextLanguage, theme } },
        { updatedAt: state.dataUpdatedAt },
    );
    // `setQueryData` clears the flag: an entry marked for a reload (a write rolled back after its
    // session ended) stays marked, without a fetch from here.
    if (state.isInvalidated) {
        void client.invalidateQueries({
            queryKey: usersKeys.self(),
            exact: true,
            refetchType: 'none',
        });
    }
};

// A load cancelled while its response was on the way (a self write confirmed after it started, a
// sign-out) writes nothing: the cancel aborts the signal before the response is handled.
const syncUnlessCancelled =
    (signal: AbortSignal) =>
    (user: SelfUser): SelfUser =>
        signal.aborted ? user : syncLocalUser(user);

/** `GET /users/self`, without the `LocalUser` sync (the session loader writes it itself). */
export const fetchSelfUser = (signal?: AbortSignal): Promise<SelfUser> =>
    api('get', '/users/self', { signal }).then(toSelfUser);

export const selfUserQueryOptions = () =>
    queryOptions({
        queryKey: usersKeys.self(),
        staleTime: USERS_QUERY_DEFAULTS.self.staleTime,
        queryFn: ({ signal }) => fetchSelfUser(signal).then(syncUnlessCancelled(signal)),
    });

interface SelfUserQueryParams<T> {
    select: (user: SelfUser) => T;
    /** False while signed out: the self user is never requested without a session. */
    enabled: boolean;
}

export const useSelfUserQuery = <T>({ select, enabled }: SelfUserQueryParams<T>) =>
    useQuery({ ...selfUserQueryOptions(), select, enabled });

export const knownUsersQueryOptions = () =>
    queryOptions({
        queryKey: usersKeys.known(),
        staleTime: USERS_QUERY_DEFAULTS.known.staleTime,
        // The friends' balances.
        refetchOnMount: refetchIfRestored,
        queryFn: ({ signal }) => api('get', '/users/known-users', { signal }).then(toKnownUsers),
    });

interface KnownUsersQueryParams<T> {
    select: (friends: KnownUser[]) => T;
    /** False while signed out: the known users are never requested without a session. */
    enabled: boolean;
}

export const useKnownUsersQuery = <T>({ select, enabled }: KnownUsersQueryParams<T>) =>
    useQuery({ ...knownUsersQueryOptions(), select, enabled });

/** Unused first-user premium promo places; not persisted (spec 03 §1.4). */
export const premiumPromoQueryOptions = () =>
    queryOptions({
        queryKey: usersKeys.premiumPromo(),
        staleTime: USERS_QUERY_DEFAULTS.premiumPromo.staleTime,
        meta: { persist: USERS_QUERY_DEFAULTS.premiumPromo.persist },
        // Read once for a new user's welcome modal: no reloads while it stays mounted.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        queryFn: ({ signal }) =>
            api('get', '/users/premium-promo', { signal }).then(
                response => response.premiumPromoRemaining,
            ),
    });

export const usePremiumPromoQuery = ({ enabled }: { enabled: boolean }) =>
    useQuery({ ...premiumPromoQueryOptions(), enabled });
