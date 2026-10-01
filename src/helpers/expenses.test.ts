import { describe, expect, test } from 'vitest';

import { ROUTES } from 'constants/routes';

import {
    getAddExpenseAvailability,
    hasValidFriendExpenseTarget,
    hasValidGroupExpenseTarget,
} from './expenses';

describe('expense targets', () => {
    test.each([
        { friendCount: 0, expected: false },
        { friendCount: 1, expected: true },
    ])('friend count $friendCount availability', ({ friendCount, expected }) => {
        expect(hasValidFriendExpenseTarget(friendCount)).toBe(expected);
    });

    test.each([
        { memberCount: 0, expected: false },
        { memberCount: 1, expected: false },
        { memberCount: 2, expected: true },
    ])('group member count $memberCount availability', ({ memberCount, expected }) => {
        expect(hasValidGroupExpenseTarget(memberCount)).toBe(expected);
    });
});

describe('getAddExpenseAvailability', () => {
    test.each([
        {
            name: 'dashboard with a friend',
            pathname: ROUTES.DASHBOARD,
            friendCount: 1,
            groupMemberCounts: [],
            selectedGroupMemberCount: 0,
            expected: { canAddExpense: true, unavailableReason: null },
        },
        {
            name: 'dashboard with a usable group',
            pathname: ROUTES.DASHBOARD,
            friendCount: 0,
            groupMemberCounts: [2],
            selectedGroupMemberCount: 0,
            expected: { canAddExpense: true, unavailableReason: null },
        },
        {
            name: 'dashboard with only a single-member group',
            pathname: ROUTES.DASHBOARD,
            friendCount: 0,
            groupMemberCounts: [1],
            selectedGroupMemberCount: 0,
            expected: { canAddExpense: false, unavailableReason: 'dashboard' },
        },
        {
            name: 'empty dashboard',
            pathname: ROUTES.DASHBOARD,
            friendCount: 0,
            groupMemberCounts: [],
            selectedGroupMemberCount: 0,
            expected: { canAddExpense: false, unavailableReason: 'dashboard' },
        },
        {
            name: 'friends page with a friend',
            pathname: ROUTES.FRIENDS,
            friendCount: 1,
            groupMemberCounts: [],
            selectedGroupMemberCount: 0,
            expected: { canAddExpense: true, unavailableReason: null },
        },
        {
            name: 'friends page without friends',
            pathname: ROUTES.FRIENDS,
            friendCount: 0,
            groupMemberCounts: [2],
            selectedGroupMemberCount: 0,
            expected: { canAddExpense: false, unavailableReason: 'friends' },
        },
        {
            name: 'group page with another member',
            pathname: `${ROUTES.GROUP}/group-1`,
            friendCount: 0,
            groupMemberCounts: [],
            selectedGroupMemberCount: 2,
            expected: { canAddExpense: true, unavailableReason: null },
        },
        {
            name: 'single-member group page',
            pathname: `${ROUTES.GROUP}/group-1`,
            friendCount: 1,
            groupMemberCounts: [2],
            selectedGroupMemberCount: 1,
            expected: { canAddExpense: false, unavailableReason: 'group' },
        },
        {
            name: 'group join route uses global targets',
            pathname: `${ROUTES.GROUP_JOIN}/invite-token`,
            friendCount: 0,
            groupMemberCounts: [2],
            selectedGroupMemberCount: 0,
            expected: { canAddExpense: true, unavailableReason: null },
        },
    ])(
        '$name',
        ({
            pathname,
            friendCount,
            groupMemberCounts,
            selectedGroupMemberCount,
            expected,
        }) => {
            expect(
                getAddExpenseAvailability({
                    pathname,
                    friendCount,
                    groupMemberCounts,
                    selectedGroupMemberCount,
                }),
            ).toEqual(expected);
        },
    );
});
