import type { SelfUser } from 'api/chipin.types';
import type { LocalUser } from 'helpers/localStorage';

import type { InvalidateKnownUsersOptions } from '../internal/usersQueryBridge';

interface UsersStoreState {
    user: SelfUser | null;
    hasConfirmedUser: boolean;
    localUser: LocalUser | null;
}

interface UsersStoreActions {
    fetchSetUser: (force?: boolean) => Promise<SelfUser | null>;
    /** Bridge: a session start or a legacy change of the friends marks `users.known` stale. */
    invalidateKnownUsers: (options?: InvalidateKnownUsersOptions) => Promise<void>;
    setInitialUsersStore: () => void;
}

type UsersStore = UsersStoreState & UsersStoreActions;

export type { UsersStore, UsersStoreActions, UsersStoreState };
