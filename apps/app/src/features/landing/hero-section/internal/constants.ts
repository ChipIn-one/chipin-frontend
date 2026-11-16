import { HandCoinsIcon, ReceiptIcon, UserCheckIcon, Users2Icon } from 'lucide-react';

// The four metrics of `GET /stats` (chipin-backend#180), in the approved order.
const LANDING_STATISTICS = [
    {
        field: 'expensesCount',
        labelKey: 'expensesSplit',
        Icon: ReceiptIcon,
    },
    {
        field: 'debtsTracked',
        labelKey: 'debtsTracked',
        Icon: HandCoinsIcon,
    },
    {
        field: 'activeGroupsCount',
        labelKey: 'activeGroups',
        Icon: Users2Icon,
    },
    {
        field: 'peopleSharingCount',
        labelKey: 'peopleSharing',
        Icon: UserCheckIcon,
    },
] as const;

export { LANDING_STATISTICS };
