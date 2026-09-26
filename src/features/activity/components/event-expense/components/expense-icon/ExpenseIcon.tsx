import { LucideBanknoteArrowDown, LucideBanknoteArrowUp, LucideTrash2 } from 'lucide-react';

import { Avatar } from '@radix-ui/themes';

interface Props {
    isReversed: boolean;
    hasCurrentUser: boolean;
    isCurrentUserPayer: boolean;
}

const getIconColor = (
    isReversed: boolean,
    hasCurrentUser: boolean,
    isCurrentUserPayer: boolean,
) => {
    if (isReversed) {
        return 'red';
    }

    if (!hasCurrentUser) {
        return 'gray';
    }

    return isCurrentUserPayer ? 'green' : 'red';
};

const getExpenseIcon = (isReversed: boolean, isCurrentUserPayer: boolean) => {
    if (isReversed) {
        return <LucideTrash2 size={28} />;
    }

    if (isCurrentUserPayer) {
        return <LucideBanknoteArrowUp size={28} />;
    }

    return <LucideBanknoteArrowDown size={28} />;
};

const ExpenseIcon = ({
    isReversed,
    hasCurrentUser,
    isCurrentUserPayer,
}: Props) => (
    <Avatar
        size="4"
        variant="soft"
        color={getIconColor(isReversed, hasCurrentUser, isCurrentUserPayer)}
        fallback={getExpenseIcon(isReversed, isCurrentUserPayer)}
    />
);

export { ExpenseIcon };
