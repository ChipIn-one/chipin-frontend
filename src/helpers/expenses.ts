import { ROUTES } from 'constants/routes';

interface ExpenseAvailability {
    pathname: string;
    hasFriends: boolean;
    hasAvailableGroup: boolean;
    hasSelectedGroupMembers: boolean;
}

export const getCanAddExpense = ({
    pathname,
    hasFriends,
    hasAvailableGroup,
    hasSelectedGroupMembers,
}: ExpenseAvailability) => {
    if (pathname === ROUTES.FRIENDS) {
        return hasFriends;
    }

    const isGroupPage =
        pathname.startsWith(`${ROUTES.GROUP}/`) &&
        !pathname.startsWith(`${ROUTES.GROUP_JOIN}/`);

    return isGroupPage
        ? hasSelectedGroupMembers
        : hasAvailableGroup || hasFriends;
};
