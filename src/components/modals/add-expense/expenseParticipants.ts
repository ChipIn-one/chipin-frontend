import type { SettledFriend, UnsettledFriends, User } from 'api/chipin.types';

export type ExpenseTargetMode = 'group' | 'friends';

interface KnownFriendsParams {
    unSettledFriends?: UnsettledFriends[];
    settledFriends?: SettledFriend[];
}

interface DirectMembersParams {
    user: User | null;
    knownFriends: User[];
    friendId: string;
}

interface DefaultFriendIdParams {
    knownFriends: User[];
    preferredFriendId?: string;
}

interface DirectExpenseValidationParams {
    userId?: string;
    participantIds: string[];
    payerId: string;
    knownFriends: User[];
}

export const getKnownFriends = ({
    unSettledFriends = [],
    settledFriends = [],
}: KnownFriendsParams): User[] => {
    const friendsById = new Map<string, User>();
    const addFriend = (friend: SettledFriend | User | { user: User }) => {
        const user = 'user' in friend ? friend.user : friend;

        friendsById.set(user.id, user);
    };

    unSettledFriends.forEach(currencyGroup => {
        (currencyGroup.friends ?? []).forEach(friend => {
            addFriend(friend);
        });
    });

    settledFriends.forEach(friend => {
        addFriend(friend);
    });

    return Array.from(friendsById.values());
};

export const getDefaultFriendId = ({
    knownFriends,
    preferredFriendId,
}: DefaultFriendIdParams): string => {
    if (preferredFriendId && knownFriends.some(friend => friend.id === preferredFriendId)) {
        return preferredFriendId;
    }

    return knownFriends[0]?.id ?? '';
};

export const getDirectMembers = ({ user, knownFriends, friendId }: DirectMembersParams): User[] => {
    const selectedFriend = knownFriends.find(friend => friend.id === friendId);

    return [user, selectedFriend].filter((member): member is User => Boolean(member));
};

export const getFriendExpenseMembers = ({
    user,
    knownFriends,
    friendId,
}: DirectMembersParams): User[] => {
    if (friendId) {
        return getDirectMembers({ user, knownFriends, friendId });
    }

    return [user, ...knownFriends].filter((member): member is User => Boolean(member));
};

export const isValidDirectExpense = ({
    userId,
    participantIds,
    payerId,
    knownFriends,
}: DirectExpenseValidationParams): boolean => {
    const participantIdSet = new Set(participantIds);
    const friendParticipantIds = participantIds.filter(participantId => participantId !== userId);
    const friendParticipantId = friendParticipantIds[0];
    const isKnownFriend = knownFriends.some(friend => friend.id === friendParticipantId);

    return (
        Boolean(userId) &&
        friendParticipantIds.length === 1 &&
        isKnownFriend &&
        participantIds.length === 2 &&
        participantIdSet.size === 2 &&
        participantIdSet.has(userId ?? '') &&
        participantIdSet.has(payerId)
    );
};
