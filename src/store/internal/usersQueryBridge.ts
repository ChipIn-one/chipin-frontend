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
        client.setQueryData(usersKeys.self(), user, { updatedAt });
    });
};

/** The cached self user of the signed-in user (`LocalUser.id`), for legacy store actions. */
export const getCachedSelfUser = (): SelfUser | undefined => {
    const userId = getLocalUser()?.id;
    const client = userId === undefined ? undefined : cachesByUser.get(userId)?.client;

    return client?.getQueryData<SelfUser>(usersKeys.self());
};
