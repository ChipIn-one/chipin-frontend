import { LucideHandCoins, LucideReceipt, LucideUserCheck, LucideUsers2 } from 'lucide-react';

const LANDING_STATISTICS = [
    {
        field: 'usersCount',
        labelKey: 'totalUsers',
        Icon: LucideUserCheck,
    },
    {
        field: 'expensesCount',
        labelKey: 'expensesTracked',
        Icon: LucideReceipt,
    },
    {
        field: 'groupsCount',
        labelKey: 'groupsCreated',
        Icon: LucideUsers2,
    },
    {
        field: 'settlementsCount',
        labelKey: 'settlementsRecorded',
        Icon: LucideHandCoins,
    },
] as const;

export { LANDING_STATISTICS };
