import { describe, expect, test } from 'vitest';

import { ROUTES } from 'constants/routes';

import { getCanAddExpense } from './expenses';

interface Availability {
    hasFriends: boolean;
    hasAvailableGroup: boolean;
    hasSelectedGroupMembers: boolean;
}

const unavailable: Availability = {
    hasFriends: false,
    hasAvailableGroup: false,
    hasSelectedGroupMembers: false,
};

describe('getCanAddExpense', () => {
    test.each([
        {
            name: 'dashboard with a friend',
            pathname: ROUTES.DASHBOARD,
            availability: { ...unavailable, hasFriends: true },
            expected: true,
        },
        {
            name: 'dashboard with a non-empty group',
            pathname: ROUTES.DASHBOARD,
            availability: { ...unavailable, hasAvailableGroup: true },
            expected: true,
        },
        {
            name: 'empty dashboard',
            pathname: ROUTES.DASHBOARD,
            availability: unavailable,
            expected: false,
        },
        {
            name: 'friends page with friends',
            pathname: ROUTES.FRIENDS,
            availability: { ...unavailable, hasFriends: true },
            expected: true,
        },
        {
            name: 'friends page without friends',
            pathname: ROUTES.FRIENDS,
            availability: {
                ...unavailable,
                hasAvailableGroup: true,
            },
            expected: false,
        },
        {
            name: 'group page with members',
            pathname: `${ROUTES.GROUP}/group-1`,
            availability: {
                ...unavailable,
                hasSelectedGroupMembers: true,
            },
            expected: true,
        },
        {
            name: 'empty group page',
            pathname: `${ROUTES.GROUP}/group-1`,
            availability: {
                ...unavailable,
                hasFriends: true,
                hasAvailableGroup: true,
            },
            expected: false,
        },
        {
            name: 'group join route with an available group',
            pathname: `${ROUTES.GROUP_JOIN}/invite-token`,
            availability: {
                ...unavailable,
                hasAvailableGroup: true,
            },
            expected: true,
        },
    ])('$name', ({ pathname, availability, expected }) => {
        expect(
            getCanAddExpense({
                pathname,
                ...availability,
            }),
        ).toBe(expected);
    });
});
