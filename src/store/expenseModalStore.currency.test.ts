import { beforeEach, expect, test } from 'vitest';

import {
    type ExpenseParticipant,
    useExpenseModalStore,
} from './expenseModalStore';

const currentUser = {
    id: 'user-1',
    displayName: 'You',
    picture: null,
} satisfies ExpenseParticipant;

const groupMember = {
    id: 'user-2',
    displayName: 'Group member',
    picture: null,
} satisfies ExpenseParticipant;

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

test('uses the selected group last used currency when initializing a group expense', () => {
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [
            {
                id: 'group-1',
                members: [currentUser, groupMember],
                lastUsedCurrency: 'KHR',
            },
        ],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });

    expect(useExpenseModalStore.getState().currency).toBe('KHR');
});

test('keeps the user default currency when the group has no last used currency', () => {
    useExpenseModalStore.getState().initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [{ id: 'group-1', members: [currentUser, groupMember] }],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });

    expect(useExpenseModalStore.getState().currency).toBe('USD');
});

test('restores the user default currency when switching an untouched group draft to friends', () => {
    const store = useExpenseModalStore.getState();

    store.initialize({
        context: 'dashboard',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [
            {
                id: 'group-1',
                members: [currentUser, groupMember],
                lastUsedCurrency: 'KHR',
            },
        ],
        knownFriends: [groupMember],
        defaultGroupId: 'group-1',
    });
    store.setTargetMode('friends');

    expect(useExpenseModalStore.getState().currency).toBe('USD');
});

test('uses the new group last used currency when switching an untouched group draft', () => {
    const store = useExpenseModalStore.getState();

    store.initialize({
        context: 'dashboard',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [
            {
                id: 'group-1',
                members: [currentUser, groupMember],
                lastUsedCurrency: 'KHR',
            },
            {
                id: 'group-2',
                members: [currentUser, groupMember],
                lastUsedCurrency: 'JPY',
            },
        ],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });
    store.setGroupId('group-2');

    expect(useExpenseModalStore.getState().currency).toBe('JPY');
});

test('keeps a manually selected currency after initialization', () => {
    const store = useExpenseModalStore.getState();

    store.initialize({
        context: 'group',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [
            {
                id: 'group-1',
                members: [currentUser, groupMember],
                lastUsedCurrency: 'KHR',
            },
        ],
        knownFriends: [groupMember],
        defaultGroupId: 'group-1',
    });
    store.setCurrency('EUR');
    store.setTargetMode('friends');
    store.setGroupId('group-1');

    expect(useExpenseModalStore.getState().currency).toBe('EUR');
});
