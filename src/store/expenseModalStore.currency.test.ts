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
                ...({ lastUsedCurrency: 'KHR' } as {
                    lastUsedCurrency: string;
                }),
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
                ...({ lastUsedCurrency: 'KHR' } as {
                    lastUsedCurrency: string;
                }),
            },
        ],
        knownFriends: [],
        defaultGroupId: 'group-1',
    });
    store.setCurrency('EUR');
    store.setGroupId('group-1');

    expect(useExpenseModalStore.getState().currency).toBe('EUR');
});
