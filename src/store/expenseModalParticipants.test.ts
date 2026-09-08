import { beforeEach, expect, test } from 'vitest';

import {
    selectExpenseParticipant,
    selectIsSubmitDisabled,
    selectUsers,
} from './expenseModalSelectors';
import {
    type ExpenseParticipant,
    useExpenseModalStore,
} from './expenseModalStore';

const currentUser = {
    id: 'user-1',
    displayName: 'You',
    picture: null,
} satisfies ExpenseParticipant;

const friend = {
    id: 'user-2',
    displayName: 'Friend',
    picture: null,
} satisfies ExpenseParticipant;

const anotherFriend = {
    id: 'user-3',
    displayName: 'Another friend',
    picture: null,
} satisfies ExpenseParticipant;

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

test('uses a preferred known friend and falls back to the first friend', () => {
    const source = {
        context: 'friends' as const,
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [friend, anotherFriend],
        preferredFriendId: anotherFriend.id,
    };

    useExpenseModalStore.getState().initialize(source);
    expect(useExpenseModalStore.getState().selectedFriendId).toBe(
        anotherFriend.id,
    );

    useExpenseModalStore.getState().initialize({
        ...source,
        knownFriends: [friend],
    });
    expect(useExpenseModalStore.getState().selectedFriendId).toBe(friend.id);
});

test('shows either a fixed direct pair or the selectable friend list', () => {
    useExpenseModalStore.getState().initialize({
        context: 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [friend, anotherFriend],
        preferredFriendId: friend.id,
    });

    expect(selectUsers(useExpenseModalStore.getState()).map(user => user.id)).toEqual([
        currentUser.id,
        friend.id,
    ]);

    useExpenseModalStore.getState().initialize({
        context: 'dashboard',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [friend, anotherFriend],
    });

    expect(selectUsers(useExpenseModalStore.getState()).map(user => user.id)).toEqual([
        currentUser.id,
        friend.id,
        anotherFriend.id,
    ]);
});

test('requires current user and one known friend for direct expense', () => {
    useExpenseModalStore.getState().initialize({
        context: 'friends',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [friend],
        preferredFriendId: friend.id,
    });
    useExpenseModalStore.getState().setDescription('Dinner');
    useExpenseModalStore.getState().setAmount('100');

    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(false);

    useExpenseModalStore.setState({
        includedParticipantIds: {
            [currentUser.id]: true,
            [friend.id]: false,
        },
    });

    expect(selectIsSubmitDisabled(useExpenseModalStore.getState())).toBe(true);
});

test('resolves a participant from the shared split derivation', () => {
    useExpenseModalStore.getState().initialize({
        context: 'dashboard',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [],
        knownFriends: [friend, anotherFriend],
    });

    const state = useExpenseModalStore.getState();

    expect(selectExpenseParticipant(state, friend.id)).toBe(friend);
    expect(selectExpenseParticipant(state, 'missing-user')).toBeUndefined();
});
