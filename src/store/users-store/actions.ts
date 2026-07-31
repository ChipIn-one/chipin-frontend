import i18n from 'i18next';
import { toast } from 'sonner';
import { create } from 'zustand';

import type { UpdateUserParams, UserSettings } from 'api/chipin.types';
import * as usersApi from 'api/usersApi';
import { DAY, SECOND } from 'constants/time';
import { saveLocalUser, toLocalUser } from 'helpers/localStorage';
import { getUnixTimestampInSec } from 'helpers/time';

import { useLoadingStore } from '../loadingStore';

import { createInitialState } from './initialState';
import type { UsersStore } from './types';

// TODO: Guard user-store responses so reset or logout cannot be undone by stale requests.
const useUsersStore = create<UsersStore>((set, get) => ({
    ...createInitialState(),

    fetchSetUser: () => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('users', 'self', 'loading');

        return usersApi
            .fetchUser()
            .then(user => {
                const nextLocalUser = toLocalUser(user);
                saveLocalUser(nextLocalUser);
                set({ user, localUser: nextLocalUser });

                return user;
            })
            .catch((error: unknown) => {
                console.error('Error fetching user:', error);
                return Promise.reject(error);
            })
            .finally(() => {
                setLoading('users', 'self', 'fetched');
            });
    },
    fetchSetFriends: () => {
        const { setLoading } = useLoadingStore.getState();
        setLoading('users', 'friends', 'loading');

        return usersApi
            .fetchKnownUsers()
            .then(({ friends }) => {
                set({ friends });
            })
            .catch((error: unknown) => {
                console.error('Error fetching known users:', error);
                return Promise.reject(error);
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

        return usersApi
            .removeKnownUser({ userId })
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

                    const balances = [];

                    for (const balance of friend.balances) {
                        const nextBalance =
                            balance.currency === params.currency
                                ? {
                                      ...balance,
                                      netAmount: balance.netAmount + amountToSet,
                                  }
                                : balance;

                        if (nextBalance.netAmount !== 0) {
                            balances.push(nextBalance);
                        }
                    }

                    return {
                        ...friend,
                        balances,
                    };
                }),
            };
        });
    },
    // TODO: Coordinate concurrent full-settings updates so older snapshots cannot overwrite newer changes.
    setUserSettings: params => {
        const { user, localUser } = get();
        const currentSettings = user?.settings ?? localUser?.settings;
        let nextSettings: UserSettings | undefined;

        if (params.settings) {
            if (!currentSettings) {
                return Promise.resolve();
            }

            nextSettings = {
                ...currentSettings,
                ...params.settings,
            };
        }

        const request = {
            ...(params.displayName !== undefined && { displayName: params.displayName }),
            ...(nextSettings && { settings: nextSettings }),
        } satisfies UpdateUserParams;

        return usersApi
            .updateUser(request)
            .then(user => {
                const nextLocalUser = toLocalUser(user);
                saveLocalUser(nextLocalUser);
                set({ user, localUser: nextLocalUser });
            })
            .catch((error: unknown) => {
                console.error('Error updating user:', error);
                toast.error(i18n.t('toasts:settings.saveError'));
                return Promise.reject(error);
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
        set(createInitialState());
    },
}));

export { useUsersStore };
