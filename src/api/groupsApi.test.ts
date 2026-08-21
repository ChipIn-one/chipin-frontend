import { beforeEach, describe, expect, test, vi } from 'vitest';

import { apiInstance } from './chipin.instance';
import type { Group } from './chipin.types';
import { uploadGroupCover } from './groupsApi';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        put: vi.fn(),
    },
}));

const group = {
    id: 'group-1',
    name: 'Weekend Trip',
    inviteToken: 'invite-token',
    description: 'Trip expenses',
    creator: {
        id: 'user-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        firstName: 'Alice',
        lastName: null,
        picture: null,
        createdAt: 1,
        updatedAt: 1,
    },
    members: [],
    createdAt: 1,
    updatedAt: 2,
    coverUrl: 'https://cdn.example.com/group.webp',
    simplifyDebts: true,
    role: 'OWNER',
    status: 'ACTIVE',
    lastUsedCurrency: null,
    recentActivities: { items: [], nextCursor: null },
} satisfies Group;

describe('groupsApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('uploads a group cover as multipart data and reports bounded progress', () => {
        const file = new File(['cover'], 'cover.webp', { type: 'image/webp' });
        const onProgress = vi.fn();

        vi.mocked(apiInstance.put).mockResolvedValue({ data: group });

        const uploadPromise = uploadGroupCover({ groupId: group.id, file, onProgress });
        const [path, body, config] = vi.mocked(apiInstance.put).mock.calls[0];

        expect(path).toBe('/groups/group-1/cover');
        expect(body).toBeInstanceOf(FormData);

        if (!(body instanceof FormData)) {
            throw new Error('Expected group cover upload body to be FormData');
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
        config?.onUploadProgress?.({
            loaded: 5,
            total: 4,
            bytes: 2,
            lengthComputable: true,
            upload: true,
        });
        config?.onUploadProgress?.({
            loaded: 1,
            bytes: 1,
            lengthComputable: false,
            upload: true,
        });

        expect(onProgress).toHaveBeenNthCalledWith(1, 75);
        expect(onProgress).toHaveBeenNthCalledWith(2, 100);
        expect(onProgress).toHaveBeenCalledTimes(2);

        return uploadPromise.then(result => {
            expect(result).toEqual(group);
        });
    });
});
