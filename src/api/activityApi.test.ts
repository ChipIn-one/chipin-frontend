import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AppEvent } from 'api/activity.types';

import {
    fetchActivities,
    fetchActivityChildren,
    fetchActivityPreviews,
} from './activityApi';
import { apiInstance } from './chipin.instance';

vi.mock('./chipin.instance', () => ({
    apiInstance: {
        get: vi.fn(),
    },
}));

describe('activityApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('fetches the current user activity feed with pagination', () => {
        const response = { items: [], nextCursor: null };
        const controller = new AbortController();
        vi.mocked(apiInstance.get).mockResolvedValue({ data: response });

        return fetchActivities({ limit: 15, cursor: 0 }, controller.signal).then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith('/users/self/activities', {
                params: { limit: 15, cursor: 0 },
                signal: controller.signal,
            });
            expect(result).toEqual(response);
        });
    });

    test('fetches child activities for the requested parent and category', () => {
        const response = { parent: {} as AppEvent, items: [], nextCursor: null };
        const controller = new AbortController();
        vi.mocked(apiInstance.get).mockResolvedValue({ data: response });

        return fetchActivityChildren({
            parentActivityId: 'activity-1',
            category: 'expense',
            limit: 15,
            cursor: 30,
        }, controller.signal).then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith(
                '/users/self/activities/activity-1/children',
                {
                    params: {
                        category: 'expense',
                        limit: 15,
                        cursor: 30,
                    },
                    signal: controller.signal,
                },
            );
            expect(result).toEqual(response);
        });
    });

    test('fetches the next dashboard activity preview page', () => {
        const response = { items: [], nextCursor: 60 };
        const controller = new AbortController();
        vi.mocked(apiInstance.get).mockResolvedValue({ data: response });

        return fetchActivityPreviews(
            { limit: 20, cursor: 40 },
            controller.signal,
        ).then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith('/users/self/activity-previews', {
                params: { limit: 20, cursor: 40 },
                signal: controller.signal,
            });
            expect(result).toEqual(response);
        });
    });
});
