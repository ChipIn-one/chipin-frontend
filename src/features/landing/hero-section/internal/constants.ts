import { HandCoinsIcon, ReceiptIcon, UserCheckIcon, Users2Icon } from 'lucide-react';

const LANDING_STATISTICS = [
    {
        field: 'usersCount',
        labelKey: 'totalUsers',
        Icon: UserCheckIcon,
    },
    {
        field: 'expensesCount',
        labelKey: 'expensesTracked',
        Icon: ReceiptIcon,
    },
    {
        field: 'groupsCount',
        labelKey: 'groupsCreated',
        Icon: Users2Icon,
    },
    {
        field: 'settlementsCount',
        labelKey: 'settlementsRecorded',
        Icon: HandCoinsIcon,
    },
] as const;

export { LANDING_STATISTICS };
