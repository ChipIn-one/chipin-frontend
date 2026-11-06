import { beforeEach, describe, expect, test, vi } from 'vitest';

import { apiInstance } from './chipin.instance';
import type { SelfUser } from './chipin.types';
import { fetchUser } from './usersApi';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        get: vi.fn(),
    },
}));

const user = {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    picture: null,
    role: 'USER',
    subscriptionUntil: null,
    inviteToken: 'invite-token-user',
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
} satisfies SelfUser;

describe('usersApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('fetches the current user', () => {
        const controller = new AbortController();
        vi.mocked(apiInstance.get).mockResolvedValue({ data: user });

        return fetchUser(controller.signal).then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith('/users/self', {
                signal: controller.signal,
            });
            expect(result).toEqual(user);
        });
    });
});
