// Bridge (spec 03 §6 row 3): the users store still loads the self user at session start and runs
// the profile and friend mutations (until 03-9b); what it gets lands in `users.self` on that
// user's QueryClient, which the UI reads, and a legacy change of the friends or their balances
// invalidates `users.known` there. Never the reverse direction.
import { type KnownUser, type SelfUser, usersKeys } from 'entities/users';
import { getLocalUser } from 'helpers/localStorage';
import { cachesByUser, seedUserCache } from 'shared/offline/userCaches';

/** Writes the user into their `users.self`; a client not created yet gets it on creation. */
export const seedSelfUser = (user: SelfUser): void => {
    const updatedAt = Date.now();

    seedUserCache(user.id, client => {
        // A refetch still in flight read the user before this change: cancelled, its state
        // reverts synchronously, so it cannot overwrite the entry; and since the abort lands
        // before its response resolves, its `queryFn` never writes `LocalUser`.
        void client.cancelQueries({ queryKey: usersKeys.self() });
        client.setQueryData(usersKeys.self(), user, { updatedAt });
    });
};

// The persisted client of this tab's user: the users store's in-memory id first (another tab may
// switch the shared `LocalUser`), then `LocalUser.id`.
const userClient = (inMemoryUserId: string | undefined) => {
    const userId = inMemoryUserId ?? getLocalUser()?.id;

    return userId === undefined ? undefined : cachesByUser.get(userId)?.client;
};

export interface InvalidateKnownUsersOptions {
    /**
     * Join a load already running instead of restarting it: a session start sends one request.
     * After a change (the default) a running load may predate it, so it is restarted.
     */
    joinRunning?: boolean;
}

/**
 * Marks the user's `users.known` stale: an active query refetches now, an inactive one on its next
 * mount; no client yet (a first sign-in) is a no-op, its first mount loads them. Never rejects.
 */
export const invalidateKnownUsers = (
    inMemoryUserId: string | undefined,
    { joinRunning = false }: InvalidateKnownUsersOptions = {},
): Promise<void> => {
    const client = userClient(inMemoryUserId);

    if (!client) {
        return Promise.resolve();
    }
    return client.invalidateQueries(
        { queryKey: usersKeys.known() },
        { cancelRefetch: !joinRunning },
    );
};

/**
 * The cached self user of this tab's user, for legacy store actions: the users store's in-memory
 * id first (another tab may switch the shared `LocalUser`), then `LocalUser.id`. The id comes in
 * as an argument: the bridge does not import the users store (a cycle).
 */
export const getCachedSelfUser = (inMemoryUserId: string | undefined): SelfUser | undefined =>
    userClient(inMemoryUserId)?.getQueryData<SelfUser>(usersKeys.self());

/** The cached known users of this tab's user, for legacy store actions (the expense editor). */
export const getCachedKnownUsers = (inMemoryUserId: string | undefined): KnownUser[] | undefined =>
    userClient(inMemoryUserId)?.getQueryData<KnownUser[]>(usersKeys.known());
