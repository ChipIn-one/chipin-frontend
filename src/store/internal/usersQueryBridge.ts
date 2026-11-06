// Bridge (spec 03 §6 row 3): the users store still loads the self user at session start and runs
// the profile mutations (until 03-9b); what it gets lands in `users.self` on that user's
// QueryClient, which the UI reads. Never the reverse direction.
import { type SelfUser, usersKeys } from 'entities/users';
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

/**
 * The cached self user of this tab's user, for legacy store actions: the users store's in-memory
 * id first (another tab may switch the shared `LocalUser`), then `LocalUser.id`. The id comes in
 * as an argument: the bridge does not import the users store (a cycle).
 */
export const getCachedSelfUser = (inMemoryUserId: string | undefined): SelfUser | undefined => {
    const userId = inMemoryUserId ?? getLocalUser()?.id;
    const client = userId === undefined ? undefined : cachesByUser.get(userId)?.client;

    return client?.getQueryData<SelfUser>(usersKeys.self());
};
