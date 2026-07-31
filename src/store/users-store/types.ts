import type {
    CreateSettlementParams,
    FriendBalance,
    KnownUser,
    RemoveKnownUserParams,
    User,
    UserSettings,
} from 'api/chipin.types';
import type { LocalUser } from 'helpers/localStorage';

interface UsersStoreState {
    user: User | null;
    localUser: LocalUser | null;
    friends: KnownUser[];
}

interface UsersStoreActions {
    fetchSetFriends: () => Promise<void>;
    fetchSetUser: () => Promise<User>;
    removeFriend: (params: RemoveKnownUserParams) => Promise<string>;
    setSettlementWithFriend: (params: CreateSettlementParams) => void;
    setUserSettings: (params: {
        displayName?: string;
        settings?: Partial<UserSettings>;
    }) => Promise<void>;
    extendUserSubscriptionByDay: () => void;
    setInitialUsersStore: () => void;
}

type UsersStore = UsersStoreState & UsersStoreActions;

interface FriendCurrencyGroup {
    currency: string;
    netBalance: number;
    friends: {
        friend: KnownUser;
        balance: FriendBalance;
    }[];
}

interface FriendsView {
    currencies: string[];
    currencyGroups: FriendCurrencyGroup[];
    settledFriends: KnownUser[];
}

export type {
    FriendCurrencyGroup,
    FriendsView,
    UsersStore,
    UsersStoreActions,
    UsersStoreState,
};
