import { beforeEach, describe, expect, test, vi } from 'vitest';

import { apiInstance } from './chipin.instance';
import type { SelfUser } from './chipin.types';
import {
    fetchKnownUsers,
    fetchUser,
    removeKnownUser,
    updateUser,
    uploadUserAvatar,
} from './usersApi';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        delete: vi.fn(),
        get: vi.fn(),
        patch: vi.fn(),
        put: vi.fn(),
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

    test('updates the current user with empty-string values intact', () => {
        const updatedUser = { ...user, displayName: '' };
        vi.mocked(apiInstance.patch).mockResolvedValue({ data: updatedUser });

        return updateUser({ displayName: '' }).then(result => {
            expect(apiInstance.patch).toHaveBeenCalledWith('/users/self', { displayName: '' });
            expect(result).toEqual(updatedUser);
        });
    });

    test('uploads the current user avatar as multipart data and reports progress', () => {
        const file = new File(['avatar'], 'avatar.webp', { type: 'image/webp' });
        const updatedUser = { ...user, picture: 'https://cdn.example.com/avatar.webp' };
        const onProgress = vi.fn();

        vi.mocked(apiInstance.put).mockResolvedValue({ data: updatedUser });

        const uploadPromise = uploadUserAvatar({ file, onProgress });
        const [path, body, config] = vi.mocked(apiInstance.put).mock.calls[0];

        expect(path).toBe('/users/self/avatar');
        expect(body).toBeInstanceOf(FormData);

        if (!(body instanceof FormData)) {
            throw new Error('Expected avatar upload body to be FormData');
        }

        expect(body.get('file')).toBe(file);
        expect(config).toMatchObject({
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        config?.onUploadProgress?.({
            loaded: 3,
            total: 4,
            bytes: 3,
            lengthComputable: true,
            upload: true,
        });

        expect(onProgress).toHaveBeenCalledWith(75);

        return uploadPromise.then(result => {
            expect(result).toEqual(updatedUser);
        });
    });

    test('fetches and removes known users', () => {
        const controller = new AbortController();
        vi.mocked(apiInstance.get).mockResolvedValue({ data: { friends: [] } });
        vi.mocked(apiInstance.delete).mockResolvedValue({ data: undefined });

        return fetchKnownUsers(controller.signal)
            .then(result => {
                expect(apiInstance.get).toHaveBeenCalledWith('/users/known-users', {
                    signal: controller.signal,
                });
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
