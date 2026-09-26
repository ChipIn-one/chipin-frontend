import { LucideHotel, LucideTrainFront, LucideUtensilsCrossed } from 'lucide-react';

import type { GroupUser } from 'api/chipin.types';

const GROUP_PREVIEW_COVER_URL =
    'https://images.unsplash.com/photo-1646590126631-c3c01f631b74?auto=format&fit=crop&w=1200&q=80';

const GROUP_PREVIEW_EXPENSES = [
    { key: 'hotel', amount: 420, debt: 210, icon: LucideHotel, payer: 'you' },
    { key: 'dinner', amount: 86, debt: -43, icon: LucideUtensilsCrossed, payer: 'Aleh' },
    { key: 'tickets', amount: 120, debt: 60, icon: LucideTrainFront, payer: 'you' },
] as const;

const GROUP_PREVIEW_NET_BALANCE = GROUP_PREVIEW_EXPENSES.reduce(
    (total, expense) => total + expense.debt,
    0,
);

const GROUP_PREVIEW_MEMBERS = [
    {
        id: 'preview-user-1',
        email: 'anna@example.com',
        displayName: 'Anna',
        firstName: 'Anna',
        lastName: null,
        picture: 'https://randomuser.me/api/portraits/women/44.jpg',
        createdAt: 0,
        updatedAt: 0,
    },
    {
        id: 'preview-user-2',
        email: 'luis@example.com',
        displayName: 'Luis',
        firstName: 'Luis',
        lastName: null,
        picture: 'https://randomuser.me/api/portraits/men/32.jpg',
        createdAt: 0,
        updatedAt: 0,
    },
    {
        id: 'preview-user-3',
        email: 'mia@example.com',
        displayName: 'Mia',
        firstName: 'Mia',
        lastName: null,
        picture: 'https://randomuser.me/api/portraits/women/65.jpg',
        createdAt: 0,
        updatedAt: 0,
    },
    {
        id: 'preview-user-4',
        email: 'noah@example.com',
        displayName: 'Noah',
        firstName: 'Noah',
        lastName: null,
        picture: 'https://randomuser.me/api/portraits/men/75.jpg',
        createdAt: 0,
        updatedAt: 0,
    },
] satisfies GroupUser[];

export {
    GROUP_PREVIEW_COVER_URL,
    GROUP_PREVIEW_EXPENSES,
    GROUP_PREVIEW_MEMBERS,
    GROUP_PREVIEW_NET_BALANCE,
};
