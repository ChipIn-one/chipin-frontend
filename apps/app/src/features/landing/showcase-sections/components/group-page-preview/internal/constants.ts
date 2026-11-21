import { HotelIcon, TrainFrontIcon, UtensilsCrossedIcon } from 'lucide-react';

import type { GroupUser } from 'api/chipin.types';

const GROUP_PREVIEW_EXPENSES = [
    { key: 'hotel', amount: 420, debt: 210, icon: HotelIcon, payer: 'you' },
    { key: 'dinner', amount: 86, debt: -43, icon: UtensilsCrossedIcon, payer: 'Aleh' },
    { key: 'tickets', amount: 120, debt: 60, icon: TrainFrontIcon, payer: 'you' },
] as const;

const GROUP_PREVIEW_NET_BALANCE = GROUP_PREVIEW_EXPENSES.reduce(
    (total, expense) => total + expense.debt,
    0,
);

// The preview loads no third-party image (#672): the cover is the gradient of `PreviewCover` and the
// members show their initials (`UsersRow` falls back to the first letter without `picture`), as on
// the site preview (`apps/site/src/lib/landingPreview.ts`).
const GROUP_PREVIEW_MEMBERS = [
    {
        id: 'preview-user-1',
        email: 'anna@example.com',
        displayName: 'Anna',
        firstName: 'Anna',
        lastName: null,
        createdAt: 0,
        updatedAt: 0,
    },
    {
        id: 'preview-user-2',
        email: 'luis@example.com',
        displayName: 'Luis',
        firstName: 'Luis',
        lastName: null,
        createdAt: 0,
        updatedAt: 0,
    },
    {
        id: 'preview-user-3',
        email: 'mia@example.com',
        displayName: 'Mia',
        firstName: 'Mia',
        lastName: null,
        createdAt: 0,
        updatedAt: 0,
    },
    {
        id: 'preview-user-4',
        email: 'noah@example.com',
        displayName: 'Noah',
        firstName: 'Noah',
        lastName: null,
        createdAt: 0,
        updatedAt: 0,
    },
] satisfies GroupUser[];

export { GROUP_PREVIEW_EXPENSES, GROUP_PREVIEW_MEMBERS, GROUP_PREVIEW_NET_BALANCE };
