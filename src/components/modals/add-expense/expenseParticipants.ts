import type { User } from 'api/chipin.types';

export type ExpenseTargetMode = 'group' | 'friends';
export type ExpenseParticipant = Pick<User, 'id' | 'displayName' | 'picture'>;

interface DirectMembersParams {
    user: User | null;
    knownFriends: ExpenseParticipant[];
    friendId: string;
}

interface DefaultFriendIdParams {
    knownFriends: ExpenseParticipant[];
    preferredFriendId?: string;
}

interface DirectExpenseValidationParams {
    userId?: string;
    participantIds: string[];
    payerId: string;
    knownFriends: ExpenseParticipant[];
}

export const getDefaultFriendId = ({
    knownFriends,
    preferredFriendId,
}: DefaultFriendIdParams): string => {
    if (preferredFriendId && knownFriends.some(friend => friend.id === preferredFriendId)) {
        return preferredFriendId;
    }

    return knownFriends[0]?.id ?? '';
};

export const getDirectMembers = ({
    user,
    knownFriends,
    friendId,
}: DirectMembersParams): ExpenseParticipant[] => {
    const selectedFriend = knownFriends.find(friend => friend.id === friendId);

    return [user, selectedFriend].filter((member): member is ExpenseParticipant =>
        Boolean(member),
    );
};

export const getFriendExpenseMembers = ({
    user,
    knownFriends,
    friendId,
}: DirectMembersParams): ExpenseParticipant[] => {
    if (friendId) {
        return getDirectMembers({ user, knownFriends, friendId });
    }

    return [user, ...knownFriends].filter((member): member is ExpenseParticipant =>
        Boolean(member),
    );
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
