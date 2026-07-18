import i18n from 'i18next';
import { toast } from 'sonner';
import { create } from 'zustand';

import { fetchApiKnownUsers, fetchApiUser, updateApiUser } from 'api/chipin';
import {
    ApiFriendsResponse,
    SettledFriend,
    UnsettledFriends,
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
    knownUsers: User[];
    unSettledFriends: UnsettledFriends[];
    settledFriends: SettledFriend[];

    fetchSetFriends: () => void;
    fetchSetUser: () => void;
    setUserSettings: (params: { displayName?: string; settings?: Partial<UserSettings> }) => void;
    extendUserSubscriptionByDay: () => void;
    setInitialUsersStore: () => void;
}

const initialUsersStore = {
    user: null,
    localUser: getLocalUser(),
    knownUsers: [],
    unSettledFriends: [],
    settledFriends: [],
};

interface KnownUsersResponse extends ApiFriendsResponse {
    friends?: Array<SettledFriend | User>;
    knownUsers?: User[];
    unSettledFriends?: UnsettledFriends[];
    unsettledFriends?: UnsettledFriends[];
    users?: User[];
}

const collectKnownUsers = ({
    directUsers,
    settledFriends,
    unSettledFriends,
}: {
    directUsers: Array<SettledFriend | User>;
    settledFriends: SettledFriend[];
    unSettledFriends: UnsettledFriends[];
}): User[] => {
    const usersById = new Map<string, User>();
    const addUser = (friend: SettledFriend | User) => {
        const user = 'user' in friend ? friend.user : friend;
        usersById.set(user.id, user);
    };

    directUsers.forEach(addUser);
    settledFriends.forEach(addUser);
    unSettledFriends.forEach(currencyGroup => {
        currencyGroup.friends.forEach(friend => {
            usersById.set(friend.user.id, friend.user);
        });
    });

    return Array.from(usersById.values());
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
            .then((response: KnownUsersResponse) => {
                const unSettledFriends =
                    response.currencies ??
                    response.unSettledFriends ??
                    response.unsettledFriends ??
                    [];
                const settledFriends = response.settledFriends ?? [];
                const knownUsers = collectKnownUsers({
                    directUsers: [
                        ...(response.users ?? []),
                        ...(response.knownUsers ?? []),
                        ...(response.friends ?? []),
                    ],
                    settledFriends,
                    unSettledFriends,
                });

                set({ knownUsers, unSettledFriends, settledFriends });
            })
            .catch(error => {
                console.error('Error fetching known users:', error);
            })
            .finally(() => {
                setLoading('users', 'friends', 'fetched');
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
