// The users entity (spec 03 §1.2, §6 row 3). `users.self` is wired; `users.known` and
// `users.premiumPromo` join in 03-9a2, with the defaults below.
import { queryOptions, useQuery } from '@tanstack/react-query';

import { getLocalUser, saveLocalUser, toLocalUser } from 'helpers/localStorage';
import { api } from 'shared/api/client';

import { toSelfUser } from '../model/toSelfUser';
import type { SelfUser } from '../model/types';

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

// A refetch keeps the cached `LocalUser` (settings, role) in step, but only for the user it
// belongs to: after an account switch the previous user's response writes nothing.
const syncLocalUser = (user: SelfUser): SelfUser => {
    if (getLocalUser()?.id === user.id) {
        saveLocalUser(toLocalUser(user));
    }
    return user;
};

export const selfUserQueryOptions = () =>
    queryOptions({
        queryKey: usersKeys.self(),
        staleTime: USERS_QUERY_DEFAULTS.self.staleTime,
        // LEGACY until 03-9b: the users store loads the self user at session start (it learns the
        // user id that picks the QueryClient) and seeds this entry, so a mount with data does not
        // send a second request. Focus and reconnect still refetch a stale entry.
        refetchOnMount: false,
        queryFn: ({ signal }) =>
            api('get', '/users/self', { signal }).then(toSelfUser).then(syncLocalUser),
    });

interface SelfUserQueryParams<T> {
    select: (user: SelfUser) => T;
    /** False while signed out: the self user is never requested without a session. */
    enabled: boolean;
}

export const useSelfUserQuery = <T>({ select, enabled }: SelfUserQueryParams<T>) =>
    useQuery({ ...selfUserQueryOptions(), select, enabled });
