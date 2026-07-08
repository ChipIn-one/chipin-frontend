import i18n from 'i18next';
import { toast } from 'sonner';
import { create } from 'zustand';

import { fetchApiKnownUsers, fetchApiUser, removeApiKnownUser, updateApiUser } from 'api/chipin';
import {
    CreateSettlementParams,
    KnownUser,
    RemoveKnownUserParams,
    UpdateUserParams,
    User,
    UserSettings,
} from 'api/chipin.types';
import { DAY, SECOND } from 'constants/time';
import { getLocalUser, LocalUser, saveLocalUser, toLocalUser } from 'helpers/localStorage';
import { getUnixTimestampInSec } from 'helpers/time';

import { useLoadingStore } from './loadingStore';

export interface UsersStore {
    user: User | null;
    localUser: LocalUser | null;
    friends: KnownUser[];

    fetchSetFriends: () => void;
    fetchSetUser: () => void;
    removeFriend: (params: RemoveKnownUserParams) => Promise<string>;
    setSettlementWithFriend: (params: CreateSettlementParams) => void;
    setUserSettings: (params: { displayName?: string; settings?: Partial<UserSettings> }) => void;
    extendUserSubscriptionByDay: () => void;
    setInitialUsersStore: () => void;
}

const initialUsersStore = {
    user: null,
    localUser: getLocalUser(),
    friends: [],
};

export const useUsersStore = create<UsersStore>((set, get) => ({
    ...initialUsersStore,

    fetchSetUser: () => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('users', 'self', 'loading');

        fetchApiUser()
            .then(user => {
                const nextLocalUser = toLocalUser(user);
                saveLocalUser(nextLocalUser);
                set({ user, localUser: nextLocalUser });
            })
            .catch(error => {
                console.error('Error fetching user:', error);
            })
            .finally(() => {
                setLoading('users', 'self', 'fetched');
            });
    },
    fetchSetFriends: () => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('users', 'friends', 'loading');

        fetchApiKnownUsers()
            .then(({ friends }) => {
                set({ friends });
            })
            .catch(error => {
                console.error('Error fetching known users:', error);
            })
            .finally(() => {
                setLoading('users', 'friends', 'fetched');
            });
    },
    removeFriend: ({ userId }) => {
        const friend = get().friends.find(knownUser => knownUser.user.id === userId);

        if (!friend) {
            return Promise.reject(new Error('Known user not found'));
        }

        const { setLoading } = useLoadingStore.getState();
        setLoading('users', 'removeFriend', 'loading');

        return removeApiKnownUser({ userId })
            .then(() => {
                set(state => ({
                    friends: state.friends.filter(knownUser => knownUser.user.id !== userId),
                }));

                return friend.user.displayName;
            })
            .finally(() => {
                setLoading('users', 'removeFriend', 'fetched');
            });
    },
    setSettlementWithFriend: params => {
        set(state => {
            const currentUserId = state.user?.id;

            if (!currentUserId) {
                return state;
            }

            const isCurrentUserPayer = params.fromUserId === currentUserId;
            const isCurrentUserRecipient = params.toUserId === currentUserId;

            if (!isCurrentUserPayer && !isCurrentUserRecipient) {
                return state;
            }

            const friendId = isCurrentUserPayer ? params.toUserId : params.fromUserId;
            const amountToSet = isCurrentUserPayer ? params.amount : -params.amount;

            return {
                friends: state.friends.map(friend => {
                    if (friend.user.id !== friendId) {
                        return friend;
                    }

                    return {
                        ...friend,
                        balances: friend.balances
                            .map(balance =>
                                balance.currency === params.currency
                                    ? {
                                          ...balance,
                                          netAmount: balance.netAmount + amountToSet,
                                      }
                                    : balance,
                            )
                            .filter(balance => balance.netAmount !== 0),
                    };
                }),
            };
        });
    },
    setUserSettings: params => {
        const { user, localUser } = get();
        const currentSettings = user?.settings ?? localUser?.settings;
        let nextSettings: UserSettings | undefined;

        if (params.settings) {
            if (!currentSettings) {
                return;
            }

            nextSettings = {
                ...currentSettings,
                ...params.settings,
            };
        }

        const request = {
            ...(params.displayName && { displayName: params.displayName }),
            ...(nextSettings && { settings: nextSettings }),
        } satisfies UpdateUserParams;

        const nextLocalUser = nextSettings
            ? ({
                  role: user?.role ?? localUser?.role ?? 'USER',
                  settings: nextSettings,
              } satisfies LocalUser)
            : localUser;

        if (nextSettings && nextLocalUser) {
            saveLocalUser(nextLocalUser);
        }

        set({
            user: user
                ? {
                      ...user,
                      ...(params.displayName !== undefined && {
                          displayName: params.displayName,
                      }),
                      ...(nextSettings && { settings: nextSettings }),
                  }
                : user,
            localUser: nextLocalUser,
        });

        updateApiUser(request)
            .then(user => {
                const nextLocalUser = toLocalUser(user);
                saveLocalUser(nextLocalUser);
                set({ user, localUser: nextLocalUser });
            })
            .catch(error => {
                console.error('Error updating user:', error);
                toast.error(i18n.t('toasts:settings.saveError'));
            });
    },
    extendUserSubscriptionByDay: () => {
        set(state => {
            if (!state.user) {
                return state;
            }

            const dayInSeconds = DAY / SECOND;
            const baseTimestamp =
                typeof state.user.subscriptionUntil === 'number'
                    ? state.user.subscriptionUntil
                    : getUnixTimestampInSec();

            return {
                user: {
                    ...state.user,
                    subscriptionUntil: baseTimestamp + dayInSeconds,
                },
            };
        });
    },
    setInitialUsersStore: () => {
        set({
            ...initialUsersStore,
            localUser: getLocalUser(),
        });
    },
}));
