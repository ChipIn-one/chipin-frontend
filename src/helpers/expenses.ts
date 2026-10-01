import { ROUTES } from 'constants/routes';

export type AddExpenseUnavailableReason = 'dashboard' | 'friends' | 'group';

interface ExpenseAvailability {
    pathname: string;
    friendCount: number;
    groupMemberCounts: number[];
    selectedGroupMemberCount: number;
}

export const hasValidFriendExpenseTarget = (friendCount: number) => friendCount > 0;

export const hasValidGroupExpenseTarget = (memberCount: number) => memberCount > 1;

export const getAddExpenseAvailability = ({
    pathname,
    friendCount,
    groupMemberCounts,
    selectedGroupMemberCount,
}: ExpenseAvailability): {
    canAddExpense: boolean;
    unavailableReason: AddExpenseUnavailableReason | null;
} => {
    const hasFriends = hasValidFriendExpenseTarget(friendCount);
    const hasAvailableGroup = groupMemberCounts.some(hasValidGroupExpenseTarget);

    if (pathname === ROUTES.FRIENDS) {
        return {
            canAddExpense: hasFriends,
            unavailableReason: hasFriends ? null : 'friends',
        };
    }

    const isGroupPage =
        pathname.startsWith(`${ROUTES.GROUP}/`) &&
        !pathname.startsWith(`${ROUTES.GROUP_JOIN}/`);

    if (isGroupPage) {
        const hasSelectedGroupTarget = hasValidGroupExpenseTarget(selectedGroupMemberCount);

        return {
            canAddExpense: hasSelectedGroupTarget,
            unavailableReason: hasSelectedGroupTarget ? null : 'group',
        };
    }

    const canAddExpense = hasAvailableGroup || hasFriends;

    return {
        canAddExpense,
        unavailableReason: canAddExpense ? null : 'dashboard',
    };
};
