import { beforeEach, describe, expect, test, vi } from 'vitest';

import { apiInstance } from './chipin.instance';
import type { User } from './chipin.types';
import { fetchKnownUsers, fetchUser, removeKnownUser, updateUser } from './usersApi';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        delete: vi.fn(),
        get: vi.fn(),
        patch: vi.fn(),
    },
}));

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    firstName: null,
    lastName: null,
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    settings: {
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        timeFormat: '24h',
        language: 'en',
        theme: 'system',
        simplifyDebts: true,
        skipCategory: false,
        soloModeByDefault: false,
        saveGroupExpensesToSolo: false,
        sex: 'male',
    },
    createdAt: 1,
    updatedAt: 1,
} satisfies User;

describe('usersApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('fetches the current user', () => {
        vi.mocked(apiInstance.get).mockResolvedValue({ data: user });

        return fetchUser().then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith('/users/self');
            expect(result).toEqual(user);
        });
    });

    test('updates the current user with empty-string values intact', () => {
        const updatedUser = { ...user, displayName: '' };
        vi.mocked(apiInstance.patch).mockResolvedValue({ data: updatedUser });

        return updateUser({ displayName: '' }).then(result => {
            expect(apiInstance.patch).toHaveBeenCalledWith('/users/self', { displayName: '' });
            expect(result).toEqual(updatedUser);
        });
    });

    test('fetches and removes known users', () => {
        vi.mocked(apiInstance.get).mockResolvedValue({ data: { friends: [] } });
        vi.mocked(apiInstance.delete).mockResolvedValue({ data: undefined });

        return fetchKnownUsers()
            .then(result => {
                expect(apiInstance.get).toHaveBeenCalledWith('/users/known-users');
                expect(result).toEqual({ friends: [] });
                return removeKnownUser({ userId: 'friend-1' });
            })
            .then(() => {
                expect(apiInstance.delete).toHaveBeenCalledWith(
                    '/users/known-users/friend-1',
                );
            });
    });
});
