import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ACTIVITY_ACTIONS } from 'constants/activity';

import {
    fetchActivities,
    fetchActivity,
    fetchActivityChildren,
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
        vi.mocked(apiInstance.get).mockResolvedValue({ data: response });

        return fetchActivities({ limit: 15, cursor: 0 }).then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith(
                '/users/self/activities?includeChildren=true',
                {
                    params: { limit: 15, cursor: 0 },
                },
            );
            expect(result).toEqual(response);
        });
    });

    test('fetches one visible activity by id', () => {
        const response = {
            id: 'activity-1',
            seq: 1,
            domain: 'LEDGER',
            action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
            actorUserId: 'user-1',
            actorSnapshot: {
                displayName: 'Alex',
                picture: null,
            },
            subjectType: 'expense',
            subjectId: 'expense-1',
            groupId: null,
            metadata: {
                type: 'expense',
                entryId: 'expense-1',
                groupId: null,
                groupName: null,
                description: 'Dinner',
                amount: 30,
                currency: 'USD',
                payerId: 'user-1',
                payerDisplayName: 'Alex',
                shares: [],
                fieldDiffs: [],
            },
            createdAt: 1_785_328_628,
            parentActivityId: null,
        };
        vi.mocked(apiInstance.get).mockResolvedValue({ data: response });

        return fetchActivity('activity-1').then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith(
                '/users/self/activities/activity-1',
            );
            expect(result).toEqual(response);
        });
    });

    test('fetches child activities for the requested parent and category', () => {
        const response = { items: [], nextCursor: null };
        vi.mocked(apiInstance.get).mockResolvedValue({ data: response });

        return fetchActivityChildren({
            parentActivityId: 'activity-1',
            category: 'expense',
            limit: 15,
            cursor: 30,
        }).then(result => {
            expect(apiInstance.get).toHaveBeenCalledWith(
                '/users/self/activities/activity-1/children',
                {
                    params: {
                        category: 'expense',
                        limit: 15,
                        cursor: 30,
                    },
                },
            );
            expect(result).toEqual(response);
        });
    });
});
