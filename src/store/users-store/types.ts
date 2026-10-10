import type {
    AcceptUserInviteParams,
    FriendBalance,
    KnownUser,
    RemoveKnownUserParams,
    SelfUser,
    UploadUserAvatarParams,
    User,
    UserSettings,
} from 'api/chipin.types';
import type { LocalUser } from 'helpers/localStorage';

interface UsersStoreState {
    user: SelfUser | null;
    localUser: LocalUser | null;
    friends: KnownUser[];
    hasConfirmedFriends: boolean;
    premiumPromoRemaining: number | null;
    isPremiumPromoResolved: boolean;
}

interface UsersStoreActions {
    acceptFriendInvite: (params: AcceptUserInviteParams) => Promise<User>;
    fetchSetFriends: (force?: boolean, rejectOnError?: boolean) => Promise<void>;
    fetchSetPremiumPromoRemaining: () => Promise<void>;
    fetchSetUser: (force?: boolean) => Promise<SelfUser | null>;
    removeFriend: (params: RemoveKnownUserParams) => Promise<void>;
    setUserSettings: (params: {
        displayName?: string;
        settings?: Partial<UserSettings>;
    }) => Promise<void>;
    uploadUserAvatar: (params: UploadUserAvatarParams) => Promise<SelfUser>;
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
